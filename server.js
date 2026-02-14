import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text,
      disable_web_page_preview: true
    })
  });
}

function cleanPhone(deviceId) {
  return (deviceId || "")
    .replace("@c.us", "")
    .replace("c.us", "")
    .replace("@", "")
    .trim();
}

app.post("/webhook", async (req, res) => {
  try {
    const evento = req.body?.event;

    if (!evento || evento.type !== "NEW_MESSAGE") {
      return res.sendStatus(200);
    }

    const msg = evento.data?.message || "";
    const nome = evento.data?.chat?.name || "";
    const deviceId = evento.data?.chat?.deviceId || "";
    const telefone = cleanPhone(deviceId);

    if (!msg) return res.sendStatus(200);

    const respostaGPT = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: `Você é um copiloto de atendimento do WhatsApp para a Construtora Lapa.
Seu papel é sugerir resposta pronta e qualificar o lead.
Seja direto, profissional e estratégico.
Responda SOMENTE em JSON válido no formato:
{
 "classificacao":"QUENTE|MORNO|FRIO|SUSPEITO",
 "intencao":"...",
 "respostas":{"curta":"...","padrao":"...","cta":"..."},
 "pergunta_unica":"...",
 "proximo_passo":"...",
 "alertas":["..."]
}`
          },
          {
            role: "user",
            content: `Mensagem: "${msg}"
Nome: "${nome}"
Contato: "${telefone}"`
          }
        ]
      })
    });

    const data = await respostaGPT.json();

const text =
  (typeof data.output_text === "string" && data.output_text.trim()) ||
  data.output?.[0]?.content?.[0]?.text ||
  data.output?.[0]?.content?.[0]?.value ||
  "{}";


    let card;
try {
  card = JSON.parse(text);
} catch {
  card = {};
}

if (!card.classificacao || !card.respostas) {
  card = {
    classificacao: "MORNO",
    intencao: "primeiro contato / qualificar",
    respostas: {
      curta: "Oi! Tudo bem? Você está buscando uma casa pra morar ou investir?",
      padrao: "Oi! Tudo bem? Pra eu te ajudar melhor, você busca pra morar ou investir? E qual região/condomínio te atende melhor?",
      cta: "Perfeito. Se fizer sentido, posso te sugerir 2 horários de visita no fim de semana. Prefere sábado ou domingo?"
    },
    pergunta_unica: "Você busca pra morar ou investir?",
    proximo_passo: "Fazer 1 pergunta e sugerir visita",
    alertas: []
  };
}

    const mensagemTelegram = 
`📩 Copiloto - Nova mensagem
👤 Contato: ${nome || "-"} (${telefone || "-"})
🧠 Classificação: ${card.classificacao}
🎯 Intenção: ${card.intencao}

✅ Resposta curta:
${card.respostas?.curta}

✅ Resposta padrão:
${card.respostas?.padrao}

✅ Resposta com CTA:
${card.respostas?.cta}

❓ Pergunta única:
${card.pergunta_unica}

➡️ Próximo passo:
${card.proximo_passo}`;

    await sendTelegram(mensagemTelegram);

    return res.sendStatus(200);

  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
});

app.get("/", (req, res) => {
  res.send("Copiloto rodando");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor iniciado");
});
