type Dict = {
  conditions: Record<string, string[]>;
  actions: Record<string, string[]>;
};

export function useDictionary() {
  const { get } = useAssetJson();
  async function loadDictionary(opts?: {
    version?: string;
    ttlMs?: number;
  }): Promise<Dict> {
    const [c, a] = await Promise.all([
      get<Record<string, string[]>>("/dictionary/conditions.json", opts),
      get<Record<string, string[]>>("/dictionary/actions.json", opts),
    ]);
    return { conditions: c ?? {}, actions: a ?? {} };
  }
  return { loadDictionary };
}
