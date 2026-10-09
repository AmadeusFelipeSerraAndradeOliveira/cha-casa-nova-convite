
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

import { auth, db, ADMIN_UID } from "./firebase-config.js";

// ========================================
// ELEMENTOS DO PAINEL
// ========================================

const listaConvidados = document.getElementById("lista-convidados");
const listaAdmin = document.getElementById("lista-admin");

const totalConfirmacoes = document.getElementById("total-confirmacoes");
const totalPessoas = document.getElementById("total-pessoas");
const totalPresentes = document.getElementById("total-presentes");
const totalDisponiveis = document.getElementById("total-disponiveis");

const botaoAdicionar = document.getElementById("botao-adicionar");
const botaoSair = document.getElementById("botao-sair");

let usuarioAutorizado = false;
let carregandoDados = false;

// ========================================
// UTILITÁRIOS
// ========================================

function criarElemento(tag, classe = "", texto = "") {
  const elemento = document.createElement(tag);

  if (classe) elemento.className = classe;
  if (texto !== undefined && texto !== null) {
    elemento.textContent = String(texto);
  }

  return elemento;
}

function criarBotao(texto, classe, acao) {
  const botao = criarElemento("button", classe, texto);

  botao.type = "button";
  botao.addEventListener("click", acao);

  return botao;
}

function formatarData(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "Data não disponível";
  }

  return timestamp.toDate().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatarErro(erro) {
  console.error("Erro no painel:", erro);

  if (erro?.code === "permission-denied") {
    return "Acesso negado pelo Firebase. Confira as regras do Firestore.";
  }

  if (erro?.code === "unavailable") {
    return "Firebase indisponível. Verifique sua conexão.";
  }

  if (erro?.code === "not-found") {
    return "O registro não foi encontrado. Atualize o painel.";
  }

  return "Não foi possível concluir a operação. Tente novamente.";
}

function exibirEstado(elemento, mensagem, classe = "empty") {
  if (!elemento) return;

  elemento.replaceChildren(
    criarElemento("p", classe, mensagem)
  );
}

function atualizarTexto(elemento, valor) {
  if (elemento) {
    elemento.textContent = String(valor);
  }
}

// ========================================
// AUTENTICAÇÃO
// ========================================

onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    usuarioAutorizado = false;
    window.location.replace("./admin.html");
    return;
  }

  if (usuario.uid !== ADMIN_UID) {
    usuarioAutorizado = false;

    try {
      await signOut(auth);
    } catch (erro) {
      console.error("Erro ao encerrar sessão não autorizada:", erro);
    }

    window.location.replace("./admin.html");
    return;
  }

  usuarioAutorizado = true;

  await carregarPainel();
});

// ========================================
// CARREGAR PAINEL
// ========================================

async function carregarPainel() {
  if (!usuarioAutorizado || carregandoDados) return;

  carregandoDados = true;

  try {
    await Promise.all([
      carregarConvidados(),
      carregarPresentes()
    ]);
  } finally {
    carregandoDados = false;
  }
}

// ========================================
// CONVIDADOS
// ========================================

async function carregarConvidados() {
  if (!listaConvidados) return;

  exibirEstado(listaConvidados, "Carregando confirmações...");

  try {
    const consulta = await getDocs(
      collection(db, "confirmacoesPrivadas")
    );

    const convidados = consulta.docs.map((documento) => ({
      id: documento.id,
      ...documento.data()
    }));

    convidados.sort((a, b) => {
      const dataA = a.criadoEm?.toMillis?.() || 0;
      const dataB = b.criadoEm?.toMillis?.() || 0;

      return dataB - dataA;
    });

    atualizarTexto(totalConfirmacoes, convidados.length);

    const pessoasConfirmadas = convidados.reduce(
      (total, convidado) => {
        if (convidado.resposta !== "sim") return total;

        const quantidade = Number(convidado.quantidade);

        return total + (
          Number.isFinite(quantidade) && quantidade > 0
            ? Math.floor(quantidade)
            : 1
        );
      },
      0
    );

    atualizarTexto(totalPessoas, pessoasConfirmadas);

    listaConvidados.replaceChildren();

    if (convidados.length === 0) {
      exibirEstado(
        listaConvidados,
        "Nenhuma confirmação recebida ainda."
      );
      return;
    }

    convidados.forEach((convidado) => {
      const card = criarElemento("article", "convidado-admin");
      const topo = criarElemento("div", "convidado-top");

      const nome = criarElemento(
        "h3",
        "",
        convidado.nome || "Convidado sem nome"
      );

      let textoResposta = "Resposta não identificada";
      let classeResposta = "pill";

      if (convidado.resposta === "sim") {
        textoResposta = "Presença confirmada ❤️";
      } else if (convidado.resposta === "nao") {
        textoResposta = "Não poderá comparecer";
        classeResposta += " nao";
      }

      const resposta = criarElemento(
        "span",
        classeResposta,
        textoResposta
      );

      topo.append(nome, resposta);
      card.appendChild(topo);

      card.appendChild(
        criarElemento(
          "p",
          "convidado-meta",
          `Registrado em: ${formatarData(convidado.criadoEm)}`
        )
      );

      if (
        convidado.quantidade !== undefined &&
        Number(convidado.quantidade) > 0
      ) {
        card.appendChild(
          criarElemento(
            "p",
            "",
            `Quantidade de pessoas: ${convidado.quantidade}`
          )
        );
      }

      const acoes = criarElemento("div", "acoes");

      acoes.appendChild(
        criarBotao(
          "Excluir confirmação",
          "excluir",
          () => excluirConfirmacao(convidado.id, convidado.nome)
        )
      );

      card.appendChild(acoes);
      listaConvidados.appendChild(card);
    });
  } catch (erro) {
    exibirEstado(listaConvidados, formatarErro(erro), "erro");
  }
}

// ========================================
// EXCLUIR CONFIRMAÇÃO
// ========================================

async function excluirConfirmacao(id, nome) {
  if (!usuarioAutorizado) return;

  const confirmar = window.confirm(
    `Deseja excluir a confirmação de "${nome || "este convidado"}"?`
  );

  if (!confirmar) return;

  try {
    await deleteDoc(
      doc(db, "confirmacoesPrivadas", id)
    );

    await carregarConvidados();

    window.alert("Confirmação excluída com sucesso.");
  } catch (erro) {
    window.alert(formatarErro(erro));
  }
}

// ========================================
// PRESENTES E RESERVAS
// ========================================

async function carregarPresentes() {
  if (!listaAdmin) return;

  exibirEstado(listaAdmin, "Carregando lista de presentes...");

  try {
    const [consultaPresentes, consultaReservas] = await Promise.all([
      getDocs(collection(db, "presentes")),
      getDocs(collection(db, "reservasPrivadas"))
    ]);

    const reservasPorPresente = new Map();

    consultaReservas.forEach((documento) => {
      reservasPorPresente.set(documento.id, documento.data());
    });

    const presentes = consultaPresentes.docs.map((documento) => ({
      id: documento.id,
      ...documento.data()
    }));

    presentes.sort((a, b) =>
      String(a.nome || "").localeCompare(
        String(b.nome || ""),
        "pt-BR"
      )
    );

    atualizarTexto(totalPresentes, presentes.length);

    const disponiveis = presentes.filter(
      (presente) => presente.escolhido !== true
    ).length;

    atualizarTexto(totalDisponiveis, disponiveis);

    listaAdmin.replaceChildren();

    if (presentes.length === 0) {
      exibirEstado(
        listaAdmin,
        "Sua lista está vazia. Clique em + Novo presente para cadastrar itens."
      );
      return;
    }

    presentes.forEach((presente) => {
      const card = criarElemento("article", "presente-admin");
      const informacoes = criarElemento("div", "informacoes");
      const escolhido = presente.escolhido === true;
      const reserva = reservasPorPresente.get(presente.id);

      if (presente.imagem) {
        const imagem = document.createElement("img");

        imagem.src = presente.imagem;
        imagem.alt = presente.nome || "Foto do presente";
        imagem.loading = "lazy";
        imagem.className = "foto-admin";

        imagem.addEventListener("error", () => {
          imagem.hidden = true;
        });

        informacoes.appendChild(imagem);
      }

      informacoes.appendChild(
        criarElemento(
          "h3",
          "",
          presente.nome || "Presente sem nome"
        )
      );

      if (presente.descricao) {
        informacoes.appendChild(
          criarElemento("p", "", presente.descricao)
        );
      }

      informacoes.appendChild(
        criarElemento(
          "p",
          `status ${escolhido ? "escolhido" : "disponivel"}`,
          escolhido ? "Reservado ❤️" : "Disponível para reserva"
        )
      );

      if (escolhido && reserva) {
        const dadosReserva = criarElemento("div", "dados-convidado");

        dadosReserva.appendChild(
          criarElemento("h4", "", "DETALHES DA RESERVA")
        );

        dadosReserva.appendChild(
          criarElemento(
            "p",
            "",
            `Reservado por: ${reserva.nome || "Nome não informado"}`
          )
        );

        if (reserva.mensagem) {
          dadosReserva.appendChild(
            criarElemento(
              "p",
              "mensagem-convidado",
              `Mensagem: ${reserva.mensagem}`
            )
          );
        }

        dadosReserva.appendChild(
          criarElemento(
            "p",
            "convidado-meta",
            `Data: ${formatarData(reserva.criadoEm)}`
          )
        );

        informacoes.appendChild(dadosReserva);
      }

      const acoes = criarElemento("div", "acoes");

      acoes.appendChild(
        criarBotao(
          "Editar",
          "",
          () => editarPresente(presente)
        )
      );

      acoes.appendChild(
        criarBotao(
          escolhido ? "Cancelar reserva" : "Excluir",
          escolhido ? "" : "excluir",
          () => excluirPresente(presente, escolhido)
        )
      );

      card.append(informacoes, acoes);
      listaAdmin.appendChild(card);
    });
  } catch (erro) {
    exibirEstado(listaAdmin, formatarErro(erro), "erro");
  }
}

// ========================================
// ADICIONAR PRESENTE
// ========================================

async function adicionarPresente() {
  if (!usuarioAutorizado) return;

  const nome = window.prompt("Nome do presente:");

  if (nome === null) return;

  if (nome.trim().length < 2) {
    window.alert("Digite um nome de presente válido.");
    return;
  }

  const descricao = window.prompt(
    "Descrição do presente (opcional):",
    ""
  );

  if (descricao === null) return;

  const imagem = window.prompt(
    "URL da imagem do presente (opcional):",
    ""
  );

  if (imagem === null) return;

  try {
    await addDoc(collection(db, "presentes"), {
      nome: nome.trim(),
      descricao: descricao.trim(),
      imagem: imagem.trim(),
      escolhido: false,
      criadoEm: serverTimestamp()
    });

    await carregarPresentes();

    window.alert("Presente adicionado com sucesso!");
  } catch (erro) {
    window.alert(formatarErro(erro));
  }
}

// ========================================
// EDITAR PRESENTE
// ========================================

async function editarPresente(presente) {
  if (!usuarioAutorizado) return;

  const nome = window.prompt(
    "Nome do presente:",
    presente.nome || ""
  );

  if (nome === null) return;

  if (nome.trim().length < 2) {
    window.alert("Digite um nome de presente válido.");
    return;
  }

  const descricao = window.prompt(
    "Descrição do presente:",
    presente.descricao || ""
  );

  if (descricao === null) return;

  const imagem = window.prompt(
    "URL da imagem:",
    presente.imagem || ""
  );

  if (imagem === null) return;

  try {
    await updateDoc(
      doc(db, "presentes", presente.id),
      {
        nome: nome.trim(),
        descricao: descricao.trim(),
        imagem: imagem.trim()
      }
    );

    await carregarPresentes();

    window.alert("Presente atualizado com sucesso!");
  } catch (erro) {
    window.alert(formatarErro(erro));
  }
}

// ========================================
// CANCELAR RESERVA OU EXCLUIR PRESENTE
// ========================================

async function excluirPresente(presente, escolhido) {
  if (!usuarioAutorizado) return;

  if (escolhido) {
    const confirmar = window.confirm(
      `Deseja cancelar a reserva de "${presente.nome}"? O presente ficará disponível novamente.`
    );

    if (!confirmar) return;

    try {
      const presenteRef = doc(db, "presentes", presente.id);
      const reservaRef = doc(db, "reservasPrivadas", presente.id);

      const reservaSnapshot = await getDoc(reservaRef);
      const lote = writeBatch(db);

      if (reservaSnapshot.exists()) {
        const dadosReserva = reservaSnapshot.data();
        const nomeKey = dadosReserva.nomeKey;

        lote.delete(reservaRef);

        if (typeof nomeKey === "string" && nomeKey.length > 0) {
          lote.delete(doc(db, "reservasPorNome", nomeKey));
        }
      }

      lote.update(presenteRef, {
        escolhido: false
      });

      await lote.commit();
      await carregarPresentes();

      window.alert(
        "Reserva cancelada! O presente está disponível novamente."
      );
    } catch (erro) {
      window.alert(formatarErro(erro));
    }

    return;
  }

  const confirmarExclusao = window.confirm(
    `Deseja excluir o presente "${presente.nome}"? Essa ação não pode ser desfeita.`
  );

  if (!confirmarExclusao) return;

  try {
    await deleteDoc(
      doc(db, "presentes", presente.id)
    );

    await carregarPresentes();

    window.alert("Presente excluído com sucesso!");
  } catch (erro) {
    window.alert(formatarErro(erro));
  }
}

// ========================================
// ABAS: CONVIDADOS E PRESENTES
// ========================================

function configurarAbas() {
  const botoes = document.querySelectorAll(".tab[data-tab]");

  const paineis = {
    convidados: document.getElementById("painel-convidados"),
    presentes: document.getElementById("painel-presentes")
  };

  botoes.forEach((botao) => {
    botao.addEventListener("click", () => {
      const alvo = botao.dataset.tab;
      const painelAlvo = paineis[alvo];

      if (!painelAlvo) return;

      botoes.forEach((item) => {
        const selecionado = item === botao;

        item.classList.toggle("active", selecionado);
        item.setAttribute(
          "aria-selected",
          selecionado ? "true" : "false"
        );
      });

      Object.entries(paineis).forEach(([nome, painel]) => {
        if (!painel) return;

        painel.classList.toggle("active", nome === alvo);
        painel.hidden = nome !== alvo;
      });
    });
  });
}

// ========================================
// BOTÕES PRINCIPAIS
// ========================================

if (botaoAdicionar) {
  botaoAdicionar.addEventListener("click", adicionarPresente);
}

if (botaoSair) {
  botaoSair.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.replace("./admin.html");
    } catch (erro) {
      console.error("Erro ao sair:", erro);
      window.alert("Não foi possível sair da conta. Tente novamente.");
    }
  });
}

configurarAbas();
