
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

import { db } from "./firebase-config.js";

// =============================================
// CONFIGURAÇÕES
// =============================================

const DATA_EVENTO = new Date(2026, 11, 12, 18, 0, 0);

const listaPresentes = document.getElementById("lista-presentes");
const formRsvp = document.getElementById("form-rsvp");
const campoNomeRsvp = document.getElementById("nome-convidado");
const campoRespostaRsvp = document.getElementById("resposta");
const botaoRsvp = document.getElementById("botao-rsvp");
const mensagemRsvp = document.getElementById("mensagem-rsvp-status");

let presenteSelecionado = null;
let enviandoRsvp = false;
let reservandoPresente = false;

// =============================================
// FUNÇÕES AUXILIARES
// =============================================

function normalizarNome(nome) {
  return String(nome || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function mostrarMensagem(elemento, mensagem, sucesso = false) {
  if (!elemento) return;

  elemento.textContent = mensagem;
  elemento.style.color = sucesso ? "#237747" : "#b42318";
}

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);

  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;

  return elemento;
}

function formatarErro(erro) {
  console.error("Erro no site:", erro);

  if (erro?.code === "permission-denied") {
    return "O Firebase recusou a operação. As regras de segurança precisam ser conferidas.";
  }

  if (erro?.code === "unavailable") {
    return "Sem conexão com o Firebase. Verifique sua internet e tente novamente.";
  }

  return erro?.message || "Não foi possível concluir. Tente novamente.";
}

// =============================================
// CONFIRMAÇÃO DE PRESENÇA
// =============================================

if (formRsvp) {
  formRsvp.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    if (enviandoRsvp) return;

    const nome = String(campoNomeRsvp?.value || "").trim();
    const resposta = String(campoRespostaRsvp?.value || "").trim();
    const nomeKey = normalizarNome(nome);

    if (nome.length < 2 || nome.length > 100 || !nomeKey) {
      mostrarMensagem(
        mensagemRsvp,
        "Digite seu nome completo, com pelo menos 2 caracteres."
      );
      return;
    }

    if (!["sim", "nao"].includes(resposta)) {
      mostrarMensagem(mensagemRsvp, "Selecione sua resposta.");
      return;
    }

    enviandoRsvp = true;
    if (botaoRsvp) botaoRsvp.disabled = true;

    mostrarMensagem(mensagemRsvp, "Registrando sua resposta...");

    try {
      const referencia = doc(db, "confirmacoesPrivadas", nomeKey);

      // A regra do Firestore deve permitir criação, mas não
      // atualização por visitantes. Assim, o mesmo ID não se repete.
      await setDoc(referencia, {
        nome,
        resposta,
        criadoEm: serverTimestamp()
      });

      mostrarMensagem(
        mensagemRsvp,
        resposta === "sim"
          ? "Presença confirmada! Ficamos felizes que você venha ❤️"
          : "Sua resposta foi registrada. Obrigado por avisar.",
        true
      );

      formRsvp.reset();
    } catch (erro) {
      mostrarMensagem(
        mensagemRsvp,
        erro?.code === "permission-denied"
          ? "Não foi possível registrar. Esse nome pode já ter sido usado ou você já confirmou a presença!"
          : formatarErro(erro)
      );
    } finally {
      enviandoRsvp = false;
      if (botaoRsvp) botaoRsvp.disabled = false;
    }
  });
}

// =============================================
// LISTA DE PRESENTES
// =============================================

async function carregarPresentes() {
  if (!listaPresentes) return;

  listaPresentes.replaceChildren(
    criarElemento("p", "", "Carregando os presentes...")
  );

  try {
    const resultado = await getDocs(collection(db, "presentes"));

    const presentes = resultado.docs.map((documento) => ({
      id: documento.id,
      ...documento.data()
    }));

    presentes.sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
    );

    listaPresentes.replaceChildren();

    if (presentes.length === 0) {
      listaPresentes.appendChild(
        criarElemento(
          "p",
          "",
          "A lista de presentes será disponibilizada em breve."
        )
      );
      return;
    }

    presentes.forEach((presente) => {
      const card = criarElemento("article", "presente-card");

      card.appendChild(
        criarElemento("h3", "", presente.nome || "Presente")
      );

      if (presente.imagem) {
        try {
          const url = new URL(presente.imagem);

          if (url.protocol === "https:" || url.protocol === "http:") {
            const imagem = document.createElement("img");
            imagem.src = url.href;
            imagem.alt = presente.nome || "Imagem do presente";
            imagem.loading = "lazy";
            imagem.style.maxWidth = "100%";
            imagem.style.height = "auto";
            card.appendChild(imagem);
          }
        } catch {
          // Ignora endereços de imagem inválidos.
        }
      }

      if (presente.descricao) {
        card.appendChild(criarElemento("p", "", presente.descricao));
      }

      const escolhido = presente.escolhido === true;

      card.appendChild(
        criarElemento(
          "p",
          escolhido ? "presente-reservado" : "presente-disponivel",
          escolhido ? "Já escolhido ❤️" : "Disponível"
        )
      );

      if (!escolhido) {
        const botao = criarElemento(
          "button",
          "botao-reservar",
          "Escolher este presente"
        );

        botao.type = "button";
        botao.addEventListener("click", () => abrirModalReserva(presente));
        card.appendChild(botao);
      }

      listaPresentes.appendChild(card);
    });
  } catch (erro) {
    listaPresentes.replaceChildren(
      criarElemento("p", "mensagem-erro", formatarErro(erro))
    );
  }
}

// =============================================
// MODAL DE RESERVA
// =============================================


function criarModalReserva() {
  let modal = document.getElementById("modal-reserva");

  if (modal) return modal;

  // Estilos do modal
  if (!document.getElementById("estilo-modal-reserva")) {
    const estilo = document.createElement("style");
    estilo.id = "estilo-modal-reserva";

    estilo.textContent = `
      #modal-reserva {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(20, 32, 25, .72);
        backdrop-filter: blur(7px);
        -webkit-backdrop-filter: blur(7px);
        animation: aparecerFundo .25s ease;
      }

      #modal-reserva .reserva-caixa {
        width: 100%;
        max-width: 460px;
        max-height: 90vh;
        overflow-y: auto;
        padding: 32px;
        background: #fffdf8;
        color: #2d332d;
        border: 1px solid #d8c49a;
        border-radius: 18px;
        box-shadow: 0 24px 80px rgba(0,0,0,.24);
        animation: subirModal .3s ease;
      }

      #modal-reserva .reserva-selo {
        display: block;
        margin-bottom: 12px;
        color: #9a7a43;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 3px;
        text-transform: uppercase;
      }

      #modal-reserva .reserva-caixa h2 {
        margin: 0 0 10px;
        color: #263b31;
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 30px;
        font-weight: 400;
      }

      #modal-reserva .reserva-descricao {
        margin: 0 0 22px;
        color: #777a70;
        font-size: 13px;
        line-height: 1.7;
      }

      #modal-reserva #modal-nome-presente {
        margin: 0 0 22px;
        padding: 13px 15px;
        border-left: 3px solid #c5a875;
        border-radius: 4px;
        background: #f3f0e7;
        color: #314636;
        font-size: 13px;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      #modal-reserva .reserva-campo {
        display: block;
        margin-bottom: 17px;
      }

      #modal-reserva .reserva-campo span {
        display: block;
        margin-bottom: 8px;
        color: #38483b;
        font-size: 12px;
        font-weight: 700;
      }

      #modal-reserva input,
      #modal-reserva textarea {
        display: block;
        width: 100%;
        box-sizing: border-box;
        padding: 13px 14px;
        border: 1px solid #d9ddd2;
        border-radius: 8px;
        background: #fff;
        color: #2d332d;
        font: inherit;
        font-size: 14px;
        outline: none;
        transition: border-color .2s, box-shadow .2s;
      }

      #modal-reserva input:focus,
      #modal-reserva textarea:focus {
        border-color: #9aab91;
        box-shadow: 0 0 0 3px rgba(154,171,145,.18);
      }

      #modal-reserva textarea {
        min-height: 100px;
        resize: vertical;
      }

      #modal-reserva .reserva-botoes {
        display: flex;
        gap: 10px;
        margin-top: 22px;
      }

      #modal-reserva .botao-confirmar-reserva,
      #modal-reserva .botao-cancelar-reserva {
        flex: 1;
        min-height: 46px;
        padding: 12px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: transform .2s, opacity .2s, background .2s;
      }

      #modal-reserva .botao-confirmar-reserva {
        border: 1px solid #263b31;
        background: #263b31;
        color: #fffdf8;
      }

      #modal-reserva .botao-cancelar-reserva {
        border: 1px solid #d9ddd2;
        background: transparent;
        color: #536050;
      }

      #modal-reserva .botao-confirmar-reserva:hover,
      #modal-reserva .botao-cancelar-reserva:hover {
        transform: translateY(-1px);
      }

      #modal-reserva button:disabled {
        opacity: .6;
        cursor: wait;
      }

      #modal-reserva #reserva-status {
        margin: 16px 0 0;
        font-size: 12px;
        line-height: 1.6;
      }

      @keyframes aparecerFundo {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes subirModal {
        from { opacity: 0; transform: translateY(14px) scale(.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @media (max-width: 480px) {
        #modal-reserva .reserva-caixa {
          padding: 24px 20px;
        }

        #modal-reserva .reserva-caixa h2 {
          font-size: 26px;
        }

        #modal-reserva .reserva-botoes {
          flex-direction: column;
        }
      }
    `;

    document.head.appendChild(estilo);
  }

  // Estrutura do modal
  modal = document.createElement("div");
  modal.id = "modal-reserva";

  const caixa = document.createElement("div");
  caixa.className = "reserva-caixa";
  caixa.setAttribute("role", "dialog");
  caixa.setAttribute("aria-modal", "true");
  caixa.setAttribute("aria-labelledby", "titulo-modal-reserva");

  const selo = criarElemento(
    "span",
    "reserva-selo",
    "CHÁ DE CASA NOVA"
  );

  const titulo = criarElemento(
    "h2",
    "",
    "Escolha com carinho"
  );
  titulo.id = "titulo-modal-reserva";

  const descricao = criarElemento(
    "p",
    "reserva-descricao",
    "Sua escolha fará parte da nossa nova história. Obrigado pelo carinho!"
  );

  const nomePresente = criarElemento("p", "", "");
  nomePresente.id = "modal-nome-presente";

  const formulario = document.createElement("form");
  formulario.id = "form-reserva";

  const campoNome = criarCampoReserva(
    "reserva-nome",
    "Seu nome completo",
    "Digite seu nome",
    "text",
    true
  );

  campoNome.querySelector("input").maxLength = 80;
  campoNome.querySelector("input").autocomplete = "name";

  const campoMensagem = criarCampoReserva(
    "reserva-mensagem",
    "Uma mensagem (opcional)",
    "Deixe uma mensagem carinhosa...",
    "textarea",
    false
  );

  campoMensagem.querySelector("textarea").maxLength = 500;

  const status = criarElemento("p", "", "");
  status.id = "reserva-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const botoes = criarElemento("div", "reserva-botoes");

  const cancelar = criarBotaoReserva(
    "Voltar",
    "botao-cancelar-reserva"
  );

  const confirmar = criarBotaoReserva(
    "Confirmar reserva ❤️",
    "botao-confirmar-reserva"
  );

  confirmar.type = "submit";

  cancelar.addEventListener("click", fecharModalReserva);

  botoes.append(cancelar, confirmar);
  formulario.append(campoNome, campoMensagem, status, botoes);

  formulario.addEventListener("submit", enviarReserva);

  caixa.append(selo, titulo, descricao, nomePresente, formulario);
  modal.appendChild(caixa);

  modal.addEventListener("click", (evento) => {
    if (evento.target === modal) {
      fecharModalReserva();
    }
  });

  document.addEventListener("keydown", (evento) => {
    if (
      evento.key === "Escape" &&
      document.getElementById("modal-reserva") &&
      !reservandoPresente
    ) {
      fecharModalReserva();
    }
  });

  document.body.appendChild(modal);

  return modal;
}

function criarCampoReserva(id, rotulo, placeholder, tipo, obrigatorio) {
  const campo = criarElemento("label", "reserva-campo");
  const texto = criarElemento("span", "", rotulo);

  let entrada;

  if (tipo === "textarea") {
    entrada = document.createElement("textarea");
  } else {
    entrada = document.createElement("input");
    entrada.type = tipo;
  }

  entrada.id = id;
  entrada.name = id;
  entrada.placeholder = placeholder;
  entrada.required = obrigatorio;

  if (obrigatorio) {
    entrada.autocomplete = "name";
  }

  campo.append(texto, entrada);

  return campo;
}

function criarBotaoReserva(texto, classe) {
  const botao = criarElemento("button", classe, texto);
  botao.type = "button";

  return botao;
}


function abrirModalReserva(presente) {
  if (presente.escolhido) {
    alert("Este presente já foi escolhido.");
    return;
  }

  presenteSelecionado = presente;

  const modal = criarModalReserva();

  document.getElementById("modal-nome-presente").textContent =
    "Presente: " + (presente.nome || "Presente");

  document.getElementById("form-reserva").reset();
  document.getElementById("reserva-status").textContent = "";

  modal.style.display = "flex";
  document.getElementById("reserva-nome").focus();
}

function fecharModalReserva() {
  const modal = document.getElementById("modal-reserva");

  if (modal && !reservandoPresente) {
    modal.style.display = "none";
    presenteSelecionado = null;
  }
}

// =============================================
// RESERVAR PRESENTE SEM CÓDIGO
// =============================================

async function enviarReserva(evento) {
  evento.preventDefault();

  if (reservandoPresente || !presenteSelecionado) return;

  const presente = presenteSelecionado;
  const nome = String(
    document.getElementById("reserva-nome")?.value || ""
  ).trim();

  const nomeKey = normalizarNome(nome);
  const mensagem = String(
    document.getElementById("reserva-mensagem")?.value || ""
  ).trim();

  const status = document.getElementById("reserva-status");
  const botao = document.querySelector(
    "#form-reserva button[type='submit']"
  );

  if (nome.length < 2 || nome.length > 80 || !nomeKey) {
    mostrarMensagem(status, "Digite seu nome completo.");
    return;
  }

  if (mensagem.length > 500) {
    mostrarMensagem(status, "A mensagem deve ter até 500 caracteres.");
    return;
  }

  reservandoPresente = true;
  if (botao) botao.disabled = true;

  mostrarMensagem(status, "Reservando presente...");

  try {
    const presenteRef = doc(db, "presentes", presente.id);
    const presenteDoc = await getDoc(presenteRef);

    if (!presenteDoc.exists()) {
      throw new Error("Este presente não está mais disponível.");
    }

    if (presenteDoc.data().escolhido === true) {
      throw new Error("Este presente já foi escolhido por outra pessoa.");
    }

    const reservaRef = doc(db, "reservasPrivadas", presente.id);
    const nomeRef = doc(db, "reservasPorNome", nomeKey);

    const lote = writeBatch(db);

    lote.set(reservaRef, {
      presenteId: presente.id,
      nome,
      nomeKey,
      mensagem,
      criadoEm: serverTimestamp()
    });

    lote.set(nomeRef, {
      presenteId: presente.id,
      nomeKey,
      criadoEm: serverTimestamp()
    });

    lote.update(presenteRef, {
      escolhido: true
    });

    await lote.commit();

    mostrarMensagem(
      status,
      "Presente reservado com sucesso! Obrigado pelo carinho ❤️",
      true
    );

    await carregarPresentes();

    window.setTimeout(() => {
      const modalAtual = document.getElementById("modal-reserva");
      if (modalAtual) modalAtual.style.display = "none";
      presenteSelecionado = null;
    }, 1400);
  } catch (erro) {
    if (
      erro?.message === "Este presente não está mais disponível." ||
      erro?.message === "Este presente já foi escolhido por outra pessoa."
    ) {
      mostrarMensagem(status, erro.message);
    } else {
      mostrarMensagem(
        status,
        erro?.code === "permission-denied"
          ? "Não foi possível registrar. Esse nome pode já ter sido usado ou você já reservou!!"
          : formatarErro(erro)
      );
    }
  } finally {
    reservandoPresente = false;
    if (botao) botao.disabled = false;
  }
}

// =============================================
// CONTAGEM REGRESSIVA
// =============================================

function atualizarContagemRegressiva() {
  const diasEl = document.getElementById("dias");
  const horasEl = document.getElementById("horas");
  const minutosEl = document.getElementById("minutos");
  const segundosEl = document.getElementById("segundos");

  if (!diasEl || !horasEl || !minutosEl || !segundosEl) return;

  const diferenca = DATA_EVENTO.getTime() - Date.now();

  if (diferenca <= 0) {
    diasEl.textContent = "00";
    horasEl.textContent = "00";
    minutosEl.textContent = "00";
    segundosEl.textContent = "00";
    return;
  }

  diasEl.textContent = String(
    Math.floor(diferenca / 86400000)
  ).padStart(2, "0");

  horasEl.textContent = String(
    Math.floor(diferenca / 3600000) % 24
  ).padStart(2, "0");

  minutosEl.textContent = String(
    Math.floor(diferenca / 60000) % 60
  ).padStart(2, "0");

  segundosEl.textContent = String(
    Math.floor(diferenca / 1000) % 60
  ).padStart(2, "0");
}

// =============================================
// INICIALIZAÇÃO
// =============================================


function iniciarSite() {
  console.log("Inicializando Chá de Casa Nova...");

  // Inicia a contagem imediatamente e atualiza a cada segundo.
  atualizarContagemRegressiva();

  if (window.intervaloContagem) {
    clearInterval(window.intervaloContagem);
  }

  window.intervaloContagem = setInterval(
    atualizarContagemRegressiva,
    1000
  );

  // Carrega os presentes do Firebase.
  carregarPresentes();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarSite, {
    once: true
  });
} else {
  iniciarSite();
}
