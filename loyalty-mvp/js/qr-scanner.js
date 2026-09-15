// Scanner de QR Code via câmera (jsQR), usado pelo lojista para ler a
// carteira digital do cliente. Sem dependências pagas.
let scannerStream = null;
let scannerRAF = null;

function openQrScanner({ onResult, onClose }) {
  const modal = document.getElementById("qr-scanner-modal");
  const video = document.getElementById("qr-video");
  const canvas = document.getElementById("qr-canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const status = document.getElementById("qr-scanner-status");

  modal.classList.remove("hidden");
  status.textContent = "Aponte a câmera para o QR Code do cliente";

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then((stream) => {
      scannerStream = stream;
      video.srcObject = stream;
      video.setAttribute("playsinline", true);
      video.play();
      scannerRAF = requestAnimationFrame(() => tick(video, canvas, ctx, onResult));
    })
    .catch(() => {
      status.textContent = "Não foi possível acessar a câmera. Verifique as permissões do navegador.";
    });

  document.getElementById("qr-scanner-close").onclick = () => closeQrScanner(onClose);
}

function tick(video, canvas, ctx, onResult) {
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data) {
      closeQrScanner();
      return onResult(code.data);
    }
  }
  scannerRAF = requestAnimationFrame(() => tick(video, canvas, ctx, onResult));
}

function closeQrScanner(onClose) {
  cancelAnimationFrame(scannerRAF);
  if (scannerStream) scannerStream.getTracks().forEach((t) => t.stop());
  scannerStream = null;
  document.getElementById("qr-scanner-modal").classList.add("hidden");
  if (onClose) onClose();
}
