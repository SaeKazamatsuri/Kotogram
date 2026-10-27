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
    const assetOptions = { ...opts, version: `${opts?.version ?? ""}:dictionary-20261027-hiragana` };
    const [c, a] = await Promise.all([
      get<Record<string, string[]>>("/dictionary/conditions.json", assetOptions),
      get<Record<string, string[]>>("/dictionary/actions.json", assetOptions),
    ]);
    return { conditions: c ?? {}, actions: a ?? {} };
  }
  return { loadDictionary };
}
