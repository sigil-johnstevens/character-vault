function escapeHtml(value) {
    if (foundry.utils.escapeHTML) return foundry.utils.escapeHTML(String(value ?? ""));
    return String(value ?? "").replace(/[&<>"']/gu, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[character]));
}

export async function runBatchOperation({
    title,
    items,
    getLabel,
    runItem,
    completedVerb,
    itemName = "item"
}) {
    const state = {
        cancelRequested: false,
        completed: 0,
        failures: []
    };
    const total = items.length;
    const DialogV2 = foundry.applications.api.DialogV2;
    const dialog = new DialogV2({
        window: { title, minimizable: true },
        content: `
            <div class="character-vault-batch-progress">
                <p data-batch-status>Preparing ${total} ${itemName}${total === 1 ? "" : "s"}…</p>
                <progress data-batch-progress value="0" max="${total}" style="width: 100%;"></progress>
                <p data-batch-count>0 of ${total}</p>
            </div>
        `,
        buttons: [{
            action: "cancel",
            label: "Cancel Remaining",
            icon: "fa-solid fa-ban",
            callback: () => {
                state.cancelRequested = true;
            }
        }],
        modal: false,
        position: { width: 480, height: "auto" }
    });

    dialog.addEventListener("close", () => {
        state.cancelRequested = true;
    });
    await dialog.render({ force: true });

    const updateProgress = (processed, label) => {
        const root = dialog.element;
        const status = root?.querySelector("[data-batch-status]");
        const progress = root?.querySelector("[data-batch-progress]");
        const count = root?.querySelector("[data-batch-count]");
        if (status) status.textContent = label;
        if (progress) progress.value = processed;
        if (count) count.textContent = `${processed} of ${total}`;
    };

    for (let index = 0; index < items.length; index++) {
        if (state.cancelRequested) break;

        const item = items[index];
        const label = getLabel(item);
        updateProgress(index, label);

        try {
            const result = await runItem(item, index);
            if (result?.ok === false) {
                state.failures.push({ label, error: result.error });
            } else {
                state.completed++;
            }
        } catch (error) {
            state.failures.push({ label, error });
        }

        updateProgress(index + 1, label);
    }

    const processed = state.completed + state.failures.length;
    const cancelled = total - processed;
    if (dialog.element?.isConnected) await dialog.close();

    const failureList = state.failures.length
        ? `<ul>${state.failures.map(failure => `<li><strong>${escapeHtml(failure.label)}</strong>: ${escapeHtml(failure.error?.message || "Unknown error")}</li>`).join("")}</ul>`
        : "";
    const cancelledText = cancelled
        ? `<p>${cancelled} ${itemName}${cancelled === 1 ? " was" : "s were"} cancelled.</p>`
        : "";

    await DialogV2.prompt({
        window: { title: `${title} Complete` },
        content: `
            <p>${completedVerb} ${state.completed} of ${total} ${itemName}${total === 1 ? "" : "s"}.</p>
            ${state.failures.length ? `<p>${state.failures.length} failed.</p>${failureList}` : ""}
            ${cancelledText}
        `,
        ok: { label: "Close", icon: "fa-solid fa-check" }
    });

    return {
        total,
        completed: state.completed,
        failed: state.failures.length,
        cancelled,
        failures: state.failures
    };
}
