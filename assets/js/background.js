/* ==========================================================================
   Lightweight animated cyberpunk background: digital grid + floating nodes
   connected by neural-network-style lines + a mouse glow. Pure canvas,
   no external deps, so it works even if particles.js CDN is unreachable.
   ========================================================================== */

(function initBackground() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let w, h, nodes = [];
  const NODE_COUNT = window.innerWidth < 700 ? 35 : 70;
  const mouse = { x: null, y: null };

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function createNodes() {
    nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 0.6,
      });
    }
  }
  createNodes();

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  function drawGrid() {
    const gridSize = 60;
    ctx.strokeStyle = "rgba(0, 229, 255, 0.045)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function drawMouseGlow() {
    if (mouse.x === null) return;
    const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 220);
    gradient.addColorStop(0, "rgba(123, 47, 247, 0.10)");
    gradient.addColorStop(1, "rgba(123, 47, 247, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(mouse.x - 220, mouse.y - 220, 440, 440);
  }

  function step() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#050816";
    ctx.fillRect(0, 0, w, h);

    drawGrid();
    drawMouseGlow();

    // Update + draw nodes
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0, 229, 255, 0.75)";
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Connect nearby nodes (neural network effect)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `rgba(123, 47, 247, ${0.18 * (1 - dist / 140)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(step);
  }

  step();
})();
