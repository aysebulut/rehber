import React, { useEffect, useMemo, useRef, useState } from "react";

const PRIMARY_MODEL = "gemini-3-flash-preview";
const API_VERSIONS = ["v1", "v1beta"];
const MAX_RETRIES_ON_503 = 3;
const PROMPT_PREFIX =
  "Sen bir sadeleştirme uzmanısın. SADECE Türkçe yaz. Teknik terim kullanma. Metni yaşlıların anlayacağı şekilde maddeler halinde açıkla. Asla JSON veya kod formatı kullanma. Sadece düz metin yaz. Metin: ";
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(rawText) {
  // Talimatı PROMPT_PREFIX ile veriyoruz; burada sadece kullanıcının metnini gönderiyoruz.
  return rawText.trim();
}

function splitSteps(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  // 1) Markdown ve yabancı biçim kalıntılarını temizle.
  const normalized = raw
    .replace(/\*\*/g, "")
    .replace(/^[#>\-\s]+/gm, "")
    .replace(/\bStep\s*(\d+)\s*:/gi, "Adım $1:")
    .replace(/(Adım\s*\d+\s*:)/gi, "\n$1")
    .replace(/(?:^|\s)(\d+[\.\)])\s+/g, "\n$1 ");

  let lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 2) "Özet:" gibi başlıkları adım listesine dahil etme ve gürültüyü temizle.
  lines = lines
    .filter((l) => !/^özet\s*:/i.test(l))
    .map((l) => l.replace(/^(Adım\s*\d+\s*:)?\s*/, "").trim())
    .filter(Boolean);

  // 3) Boş/yarım adım gürültülerini temizle (örn. "4. Adım", "Adım 5:")
  lines = lines.filter((l) => {
    if (/^\d+[\.\)]?\s*adım\s*$/i.test(l)) return false;
    if (/^adım\s*\d+\s*:?\s*$/i.test(l)) return false;
    if (l.length < 6) return false;
    return true;
  });

  // 4) Hala tek satırsa cümlelere bölüp birden çok adım üret.
  if (lines.length <= 1) {
    const sentenceParts = raw
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentenceParts.length > 1) {
      lines = sentenceParts;
    }
  }

  return lines.length ? lines : [raw];
}

function normalizeAndFormatSteps(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) return "";

  let parsedSteps = [];

  // JSON çıktısı gelirse onu kullan (doğrudan JSON, code-fence JSON veya metin içi JSON).
  const parseStepsFromJson = (jsonText) => {
    try {
      const obj = JSON.parse(jsonText);
      if (Array.isArray(obj?.steps)) {
        return obj.steps.map((s) => String(s || "").trim()).filter(Boolean);
      }
    } catch {
      // ignore
    }
    return [];
  };

  parsedSteps = parseStepsFromJson(raw);
  if (!parsedSteps.length) {
    const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      parsedSteps = parseStepsFromJson(fencedMatch[1].trim());
    }
  }
  if (!parsedSteps.length) {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      parsedSteps = parseStepsFromJson(raw.slice(firstBrace, lastBrace + 1));
    }
  }

  if (!parsedSteps.length) {
    parsedSteps = splitSteps(raw);
  }

  parsedSteps = parsedSteps
    .map((s) => s.replace(/^(Adım\s*\d+\s*:)?\s*/i, "").trim())
    .filter((s) => s.length >= 8)
    .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`));

  return parsedSteps.map((s, i) => `Adım ${i + 1}: ${s}`).join("\n");
}

function hasIncompleteTail(formattedText) {
  const steps = splitSteps(formattedText)
    .map((s) => s.replace(/^(Adım\s*\d+\s*:)?\s*/i, "").trim())
    .filter(Boolean);
  if (!steps.length) return true;
  const last = steps[steps.length - 1];
  const wordCount = last.split(/\s+/).filter(Boolean).length;
  const endsWithPunctuation = /[.!?]$/.test(last);
  return !endsWithPunctuation && wordCount <= 5;
}

async function generateWithModel({ apiKey, prompt, modelName, apiVersion, signal }) {
  const finalPrompt = `${PROMPT_PREFIX}${prompt}\n\n${OUTPUT_FORMAT_INSTRUCTION}`;
  const url =
    "https://generativelanguage.googleapis.com/" +
    apiVersion +
    "/models/" +
    encodeURIComponent(modelName) +
    ":generateContent?key=" +
    encodeURIComponent(apiKey.trim());

  const requestOnce = async (textPrompt) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: textPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
      signal,
    });

    let details = "";
    let data = null;
    try {
      data = await res.json();
      details = data?.error?.message ? ` (${data.error.message})` : "";
    } catch {
      // ignore parse errors
    }

    if (res.ok) {
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p?.text)
          .filter(Boolean)
          .join("\n") || "";
      return text.trim();
    }

    const err = new Error(
      `Gemini isteği başarısız [${apiVersion}/${modelName}]: ${res.status}${details}`,
    );
    err.status = res.status;
    throw err;
  };

  for (let attempt = 1; attempt <= MAX_RETRIES_ON_503; attempt += 1) {
    try {
      const firstRaw = await requestOnce(finalPrompt);
      let formatted = normalizeAndFormatSteps(firstRaw);

      // Son adım yarım kaldıysa bir kez onarım iste.
      if (hasIncompleteTail(formatted)) {
        const repairPrompt = [
          "Aşağıdaki adımların sonu yarım kalmış olabilir.",
          'Aynı anlamı koruyarak adımları TAMAMLAYIP sadece JSON ver: {"steps":[...]}',
          "Adımlar:",
          formatted,
        ].join("\n");
        const repairedRaw = await requestOnce(repairPrompt);
        const repairedFormatted = normalizeAndFormatSteps(repairedRaw);
        if (repairedFormatted) formatted = repairedFormatted;
      }

      return formatted;
    } catch (err) {
      if (err?.status === 503 && attempt < MAX_RETRIES_ON_503) {
        await wait(800 * attempt);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Gemini isteği başarısız [${apiVersion}/${modelName}]: 503`);
}

async function listModels({ apiKey, apiVersion, signal }) {
  const url =
    "https://generativelanguage.googleapis.com/" +
    apiVersion +
    "/models?key=" +
    encodeURIComponent(apiKey.trim());
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  const models = Array.isArray(data?.models) ? data.models : [];
  return models
    .map((m) => String(m?.name || ""))
    .map((name) => name.replace(/^models\//i, ""))
    .filter(Boolean);
}

async function callGemini({ apiKey, prompt, signal }) {
  const modelsToTry = [PRIMARY_MODEL]
    .map((m) => String(m).replace(/^models\//i, ""))
    .filter(Boolean);
  let lastError = null;

  for (const apiVersion of API_VERSIONS) {
    for (const modelName of modelsToTry) {
      try {
        return await generateWithModel({ apiKey, prompt, modelName, apiVersion, signal });
      } catch (err) {
        lastError = err;
        if (err?.status === 404) continue;
        break;
      }
    }
  }

  if (lastError?.status === 404) {
    for (const apiVersion of API_VERSIONS) {
      const modelList = await listModels({ apiKey, apiVersion, signal });
      const autoModel = modelList.find((m) => /flash/i.test(m)) || modelList[0];
      if (!autoModel) continue;

      try {
        return await generateWithModel({
          apiKey,
          prompt,
          modelName: autoModel,
          apiVersion,
          signal,
        });
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(
      `404: Model erişimi bulunamadı. Denenen model: "${PRIMARY_MODEL}". ` +
        `Neden: AI Studio'daki görünen ad ile API model kimliği farklı olabilir veya anahtarın bu modellere erişimi yok olabilir.`,
    );
  }

  if (lastError?.status === 503) {
    throw new Error(
      "Gemini şu anda yoğun (503). Lütfen 10-20 saniye sonra tekrar deneyin.",
    );
  }

  throw lastError || new Error("Gemini isteği başarısız.");
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    throw new Error("Bu cihazda sesli okuma desteklenmiyor.");
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "tr-TR";
  utter.rate = 0.95;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("GUMUS_REHBER_GEMINI_KEY") || "");

  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const abortRef = useRef(null);

  useEffect(() => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem("GUMUS_REHBER_GEMINI_KEY", trimmed);
    } else {
      localStorage.removeItem("GUMUS_REHBER_GEMINI_KEY");
    }
  }, [apiKey]);

  const steps = useMemo(() => splitSteps(output), [output]);

  async function onSimplify() {
    setError("");

    const trimmed = input.trim();
    if (!trimmed) {
      setError("Lütfen metni yapıştırın.");
      return;
    }
    if (!apiKey.trim()) {
      setError("Gemini API anahtarınızı girin.");
      return;
    }

    setLoading(true);
    setOutput("");
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const prompt = buildPrompt(trimmed);
      const text = await callGemini({ apiKey: apiKey.trim(), prompt, signal: controller.signal });
      setOutput(text);
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  function onStop() {
    abortRef.current?.abort?.();
    window.speechSynthesis?.cancel?.();
    setLoading(false);
  }

  const spokenText = useMemo(() => {
    if (!output) return "";
    return steps.join("\n");
  }, [output, steps]);

  return (
    <div className="min-h-screen bg-black text-yellow-300">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <header className="mb-6">
          <div className="text-3xl sm:text-4xl font-bold tracking-tight">Gümüş Rehber</div>
          <div className="mt-2 text-lg sm:text-xl text-yellow-200/90">
            Karmaşık metni yapıştırın, size kısa adımlar halinde anlatsın.
          </div>
        </header>

        <section className="mb-6 rounded-2xl border-2 border-yellow-400 bg-black p-5">
          <div className="mb-3 text-xl font-semibold">1) Gemini API anahtarınızı girin</div>
          <label className="block text-lg mb-2" htmlFor="apiKey">
            API Anahtarı
          </label>
          <input
            id="apiKey"
            type="password"
            inputMode="text"
            autoComplete="off"
            className="w-full rounded-xl border-2 border-yellow-400 bg-black px-4 py-3 text-[20px] text-yellow-100 outline-none focus:ring-4 focus:ring-yellow-400/40"
            placeholder="Buraya yapıştırın (örn. AIza...)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <div className="mt-2 text-base text-yellow-200/80">
            Not: Anahtar tarayıcı hafızasında saklanır; kutuyu tamamen silerseniz hafızadan da temizlenir.
          </div>
        </section>

        <section className="mb-6 rounded-2xl border-2 border-yellow-400 bg-black p-5">
          <div className="mb-3 text-xl font-semibold">2) Metni yapıştırın</div>
          <textarea
            className="w-full min-h-[180px] rounded-xl border-2 border-yellow-400 bg-black px-4 py-3 text-[20px] text-yellow-100 outline-none focus:ring-4 focus:ring-yellow-400/40"
            placeholder="Örn: e-Devlet’te şifre yenileme adımları..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onSimplify}
              disabled={loading}
              className="rounded-xl bg-yellow-400 px-6 py-4 text-[22px] font-bold text-black disabled:opacity-60"
            >
              {loading ? "Anlatılıyor..." : "Anlat"}
            </button>
            <button
              type="button"
              onClick={onStop}
              className="rounded-xl border-2 border-yellow-400 px-6 py-4 text-[22px] font-bold text-yellow-200"
            >
              Durdur
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border-2 border-red-400 bg-black px-4 py-3 text-[20px] text-red-300">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border-2 border-yellow-400 bg-black p-5">
          <div className="mb-3 text-xl font-semibold">3) Basit adımlar</div>

          {output ? (
            <>
              <ol className="list-decimal pl-7 space-y-3 text-[22px] leading-relaxed pr-3">
                {steps.map((line, idx) => (
                  <li key={idx} className="text-yellow-100 whitespace-pre-wrap break-words">
                    {line.replace(/^Adım\s*\d+\s*:\s*/i, "")}
                  </li>
                ))}
              </ol>

              <details className="mt-4 rounded-xl border border-yellow-500/70 p-3">
                <summary className="cursor-pointer text-base font-semibold text-yellow-200">
                  Ham yanıtı göster (teşhis için)
                </summary>
                <pre className="mt-3 whitespace-pre-wrap break-words text-[16px] leading-relaxed text-yellow-100">
{output}
                </pre>
              </details>

              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    try {
                      speak(spokenText);
                    } catch (e) {
                      setError(e?.message || "Sesli okuma başlatılamadı.");
                    }
                  }}
                  className="rounded-xl bg-yellow-400 px-6 py-4 text-[22px] font-bold text-black"
                >
                  Sesli Oku
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.speechSynthesis?.cancel?.();
                  }}
                  className="rounded-xl border-2 border-yellow-400 px-6 py-4 text-[22px] font-bold text-yellow-200"
                >
                  Sesli Okumayı Durdur
                </button>
              </div>
            </>
          ) : (
            <div className="text-[20px] text-yellow-200/80">
              Henüz sonuç yok. Metni yapıştırıp <span className="font-bold">Anlat</span>’a basın.
            </div>
          )}
        </section>

        <footer className="mt-8 text-sm text-yellow-200/70">
          Bu uygulama tıbbi/finansal tavsiye vermez; sadece metni basitleştirir.
        </footer>
      </div>
    </div>
  );
}

