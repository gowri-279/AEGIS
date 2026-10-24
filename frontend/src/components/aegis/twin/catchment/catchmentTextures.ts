import * as THREE from "three";

export function createTerrainGroundTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#74776e";
  ctx.fillRect(0, 0, 512, 512);
  let seed = 3917;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 84; i++) {
    const x = random() * 512;
    const y = random() * 512;
    ctx.fillStyle = ["rgba(88,111,74,.05)", "rgba(157,142,113,.045)", "rgba(190,174,139,.035)", "rgba(61,92,68,.045)"][i % 4]!;
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + random() * 42, 8 + random() * 30, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  return texture;
}

export function createTerrainBlueprintTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#17272b";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "rgba(93,142,148,.11)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(117,161,151,.09)";
  ctx.lineWidth = 2;
  for (let r = 70; r < 280; r += 52) {
    ctx.beginPath();
    ctx.ellipse(265, 260, r * 1.12, r * 0.8, -0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 8;
  return texture;
}

export function createFacadeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#aaa69b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cellW = 40;
  const cellH = 42;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 7; col++) {
      const hue = (row * 11 + col * 7) % 3;
      ctx.fillStyle = ["#647a78", "#78877e", "#536e70"][hue]!;
      ctx.fillRect(col * cellW + 7, row * cellH + 8, cellW - 14, cellH - 15);
      ctx.fillStyle = "rgba(235,229,211,.32)";
      ctx.fillRect(col * cellW + 7, row * cellH + 8, cellW - 14, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
