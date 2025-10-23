// 文字サイズなどのUI設定（LS永続）
export function useUiPrefs() {
  const KEY = "kotogram.ui";
  const fontScale = useState<number>("ui:fontScale", () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}").fontScale ?? 100;
    } catch {
      return 100;
    }
  });
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ fontScale: fontScale.value }));
    } catch {}
  }
  function inc(step = 10) {
    fontScale.value = Math.min(180, fontScale.value + step);
    save();
  }
  function dec(step = 10) {
    fontScale.value = Math.max(80, fontScale.value - step);
    save();
  }
  function reset() {
    fontScale.value = 100;
    save();
  }
  onMounted(() => save()); // 初期書き戻し
  return { fontScale, inc, dec, reset };
}
