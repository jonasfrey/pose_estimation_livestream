export const edges = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [5, 6],
  [5, 7],
  [7, 9],
  [6, 8],
  [8, 10],
  [5, 11],
  [6, 12],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
];

export function visiblePoints(points, threshold) {
  return points.filter((p) =>
    Number.isFinite(p.x) && Number.isFinite(p.y) && p.score >= threshold
  );
}

export function drawPose(ctx, points, threshold, skeleton, joints) {
  const visible = new Set(visiblePoints(points, threshold));
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#c5f581";
  if (skeleton) {
    for (const [a, b] of edges) {
      if (!visible.has(points[a]) || !visible.has(points[b])) continue;
      ctx.beginPath();
      ctx.moveTo(points[a].x, points[a].y);
      ctx.lineTo(points[b].x, points[b].y);
      ctx.stroke();
    }
  }
  if (joints) {
    for (const p of visible) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#eaffcf";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#385623";
      ctx.stroke();
    }
  }
  return visible.size;
}
