{it.kind === "transaction" ? (
  <>
    <select
      className="border rounded-lg p-2 text-xs w-full"
      value={it.categoryId ?? ""}
      onChange={(e) => setTx(it.rowHash, { categoryId: e.target.value || null })}
    >
      <option value="">(sem categoria)</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {groupIcon(c.groupName)} {c.groupName} — {c.name}
        </option>
      ))}
    </select>

    <button
      type="button"
      className="mt-2 text-[11px] underline"
      onClick={() => {
        const nextTags = new Set([...(it.tags || []), "Fixa Dividida"]);
        setTx(it.rowHash, { person: "AMBOS", tags: Array.from(nextTags) });
      }}
      title="Marca como conta fixa dividida (50/50) entre Pedro e Mirela"
    >
      ⇄ Dividir 50/50
    </button>

    <div className="text-[10px] text-zinc-500 mt-1">
      Define Pessoa = <b>Ambos</b> e adiciona tag <b>Fixa Dividida</b>.
    </div>
  </>
) : (
  <div className="text-xs text-zinc-500">—</div>
)}
