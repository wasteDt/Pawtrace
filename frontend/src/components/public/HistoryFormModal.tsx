import type { Dispatch, FormEvent, SetStateAction } from "react";
import { type HistoryDraft, type Pet } from "../../shared";

type Props = {
  historyDraft: HistoryDraft;
  setHistoryDraft: Dispatch<SetStateAction<HistoryDraft>>;
  selectedPet: Pet;
  busy: boolean;
  saveHistory: (event: FormEvent) => Promise<void>;
  setHistoryFormOpen: (open: boolean) => void;
};

export default function HistoryFormModal({
  historyDraft,
  setHistoryDraft,
  selectedPet,
  busy,
  saveHistory,
  setHistoryFormOpen,
}: Props) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && setHistoryFormOpen(false)
      }
    >
      <form className="modal-card small" onSubmit={saveHistory}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">MEDICAL HISTORY</p>
            <h2>记录 {selectedPet.name} 的病史</h2>
          </div>
          <button type="button" onClick={() => setHistoryFormOpen(false)}>
            ×
          </button>
        </div>
        <div className="form-grid">
          <label>
            记录日期
            <input
              required
              type="date"
              value={historyDraft.recordDate}
              onChange={(event) =>
                setHistoryDraft({
                  ...historyDraft,
                  recordDate: event.target.value,
                })
              }
            />
          </label>
          <label>
            疾病或症状名称
            <input
              required
              value={historyDraft.title}
              onChange={(event) =>
                setHistoryDraft({
                  ...historyDraft,
                  title: event.target.value,
                })
              }
            />
          </label>
          <label className="full">
            情况描述
            <textarea
              required
              rows={4}
              value={historyDraft.description}
              onChange={(event) =>
                setHistoryDraft({
                  ...historyDraft,
                  description: event.target.value,
                })
              }
            />
          </label>
          <label>
            就诊医院
            <input
              value={historyDraft.hospitalName}
              onChange={(event) =>
                setHistoryDraft({
                  ...historyDraft,
                  hospitalName: event.target.value,
                })
              }
            />
          </label>
          <label>
            接诊医生
            <input
              value={historyDraft.doctorName}
              onChange={(event) =>
                setHistoryDraft({
                  ...historyDraft,
                  doctorName: event.target.value,
                })
              }
            />
          </label>
          <label className="full">
            用药或治疗
            <textarea
              value={historyDraft.treatment}
              onChange={(event) =>
                setHistoryDraft({
                  ...historyDraft,
                  treatment: event.target.value,
                })
              }
            />
          </label>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setHistoryFormOpen(false)}
          >
            取消
          </button>
          <button className="primary-button compact" disabled={busy}>
            {busy ? "保存中…" : "保存病史"}
          </button>
        </div>
      </form>
    </div>
  );
}
