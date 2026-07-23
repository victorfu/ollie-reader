/**
 * 通關的彩帶。
 *
 * canvas-confetti 已經是專案依賴（Bunny Jumper 在用），所以這裡不會多帶進
 * 任何東西；用動態 import 是為了不要讓沒通關的人也付這段程式碼的下載成本。
 */
export function celebrateClear(): void {
  if (typeof window === "undefined") return;

  // 使用者要求減少動態時就不要噴東西——CLAUDE.md 的設計規範也這樣要求。
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  void import("canvas-confetti")
    .then(({ default: confetti }) => {
      const shared = {
        spread: 70,
        startVelocity: 42,
        ticks: 220,
        // 粉彩糖果色，跟遊戲的調性一致。
        colors: ["#ff9ec4", "#ffd3e2", "#f7c948", "#a8e06a", "#7fd4f5", "#c7a3f0"],
      };

      // 從畫面兩側往中間噴，比單點爆開更有「慶祝」的感覺。
      confetti({ ...shared, particleCount: 70, origin: { x: 0.2, y: 0.7 } });
      confetti({ ...shared, particleCount: 70, origin: { x: 0.8, y: 0.7 } });
    })
    .catch(() => {
      // 彩帶只是錦上添花，載不到就算了。
    });
}
