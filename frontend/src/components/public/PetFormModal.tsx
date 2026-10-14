import type { Dispatch, FormEvent, SetStateAction } from "react";
import { type PetDraft, type Pet } from "../../shared";

type Props = {
  petDraft: PetDraft;
  setPetDraft: Dispatch<SetStateAction<PetDraft>>;
  editingPetId: number | null;
  busy: boolean;
  savePet: (event: FormEvent) => Promise<void>;
  setPetFormOpen: (open: boolean) => void;
};

export default function PetFormModal({
  petDraft,
  setPetDraft,
  editingPetId,
  busy,
  savePet,
  setPetFormOpen,
}: Props) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && setPetFormOpen(false)
      }
    >
      <form className="modal-card" onSubmit={savePet}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">PET PROFILE</p>
            <h2>{editingPetId ? "编辑宠物档案" : "新增宠物档案"}</h2>
          </div>
          <button type="button" onClick={() => setPetFormOpen(false)}>
            ×
          </button>
        </div>
        <div className="form-grid">
          <label>
            宠物昵称
            <input
              required
              maxLength={50}
              value={petDraft.name}
              onChange={(event) =>
                setPetDraft({ ...petDraft, name: event.target.value })
              }
            />
          </label>
          <label>
            宠物类型
            <select
              value={petDraft.species}
              onChange={(event) =>
                setPetDraft({
                  ...petDraft,
                  species: event.target.value as Pet["species"],
                })
              }
            >
              <option value="CAT">猫</option>
              <option value="DOG">狗</option>
              <option value="OTHER">其他</option>
            </select>
          </label>
          {petDraft.species === "OTHER" && (
            <label>
              具体类型
              <input
                required
                value={petDraft.customSpecies ?? ""}
                onChange={(event) =>
                  setPetDraft({
                    ...petDraft,
                    customSpecies: event.target.value,
                  })
                }
              />
            </label>
          )}
          <label>
            品种
            <input
              value={petDraft.breed ?? ""}
              onChange={(event) =>
                setPetDraft({ ...petDraft, breed: event.target.value })
              }
            />
          </label>
          <label>
            性别
            <select
              value={petDraft.gender}
              onChange={(event) =>
                setPetDraft({
                  ...petDraft,
                  gender: event.target.value as Pet["gender"],
                })
              }
            >
              <option value="UNKNOWN">未知</option>
              <option value="MALE">公</option>
              <option value="FEMALE">母</option>
            </select>
          </label>
          <label>
            出生日期
            <input
              type="date"
              value={petDraft.birthDate ?? ""}
              onChange={(event) =>
                setPetDraft({
                  ...petDraft,
                  birthDate: event.target.value || null,
                })
              }
            />
          </label>
          <label>
            年龄描述
            <input
              placeholder="日期不确定时填写，如约3岁"
              value={petDraft.ageText ?? ""}
              onChange={(event) =>
                setPetDraft({ ...petDraft, ageText: event.target.value })
              }
            />
          </label>
          <label>
            体重（kg）
            <input
              type="number"
              min="0.01"
              max="9999"
              step="0.01"
              value={petDraft.weightKg ?? ""}
              onChange={(event) =>
                setPetDraft({
                  ...petDraft,
                  weightKg: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />
          </label>
          <label>
            是否绝育
            <select
              value={petDraft.neutered == null ? "" : String(petDraft.neutered)}
              onChange={(event) =>
                setPetDraft({
                  ...petDraft,
                  neutered:
                    event.target.value === ""
                      ? null
                      : event.target.value === "true",
                })
              }
            >
              <option value="">未知</option>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </label>
          <label className="full">
            过敏史
            <textarea
              value={petDraft.allergies ?? ""}
              onChange={(event) =>
                setPetDraft({ ...petDraft, allergies: event.target.value })
              }
            />
          </label>
          <label className="full">
            既往疾病
            <textarea
              value={petDraft.pastDiseases ?? ""}
              onChange={(event) =>
                setPetDraft({
                  ...petDraft,
                  pastDiseases: event.target.value,
                })
              }
            />
          </label>
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setPetFormOpen(false)}
          >
            取消
          </button>
          <button className="primary-button compact" disabled={busy}>
            {busy ? "保存中…" : "保存档案"}
          </button>
        </div>
      </form>
    </div>
  );
}
