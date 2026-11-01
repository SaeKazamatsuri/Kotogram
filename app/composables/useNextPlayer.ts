import { useRouter } from "vue-router";
import { useStats } from "./useStats";

export function useNextPlayer() {
  const router = useRouter();
  const { reset } = useStats();

  return () => {
    if (!import.meta.client || !window.confirm("次の人のために、きろくを消してもいい？")) return false;

    reset();
    try {
      window.sessionStorage.removeItem("kotogram.recentClear");
    } catch {
      if (import.meta.dev) console.warn("Could not clear recent stage feedback");
    }
    void router.push("/");
    return true;
  };
}
