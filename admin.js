import { auth, ADMIN_UID } from "./firebase-config.js";
import { setPersistence, browserLocalPersistence, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
const formulario = document.getElementById("login-form");
const botao = document.getElementById("botao-login");
const mensagem = document.getElementById("mensagem-login");
formulario.addEventListener("submit", async evento => {
  evento.preventDefault();
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value;
  botao.disabled = true; botao.textContent = "Verificando acesso…"; mensagem.textContent = "";
  try {
    await setPersistence(auth, browserLocalPersistence);
    const credencial = await signInWithEmailAndPassword(auth, email, senha);
    if (credencial.user.uid !== ADMIN_UID) {
      await auth.signOut();
      throw new Error("Esta conta não possui autorização administrativa.");
    }
    window.location.replace("painel.html");
  } catch (erro) {
    console.error("Falha no login:", erro);
    mensagem.textContent = erro.code === "auth/invalid-credential" || erro.code === "auth/wrong-password" || erro.code === "auth/user-not-found"
      ? "E-mail ou senha incorretos." : (erro.message || "Não foi possível entrar. Tente novamente.");
  } finally {
    botao.disabled = false; botao.textContent = "Entrar no painel ↗";
  }
});
