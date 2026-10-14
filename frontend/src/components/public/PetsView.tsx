import { type Pet, type History, type PublicView } from "../../shared";

type Props = {
  pets: Pet[];
  petsLoading: boolean;
  histories: History[];
  selectedPet: Pet | null;
  openCreatePet: () => void;
  openPetDetail: (pet: Pet) => Promise<void>;
  openEditPet: (pet: Pet) => void;
  removePet: (pet: Pet) => Promise<void>;
  setSelectedPet: (pet: Pet | null) => void;
  setHistoryFormOpen: (open: boolean) => void;
  setView: (view: PublicView) => void;
};

export default function PetsView({
  pets,
  petsLoading,
  histories,
  selectedPet,
  openCreatePet,
  openPetDetail,
  openEditPet,
  removePet,
  setSelectedPet,
  setHistoryFormOpen,
  setView,
}: Props) {
  return (
    <section className="pets-page">
      <div className="page-heading">
        <div>
          <button
            className="back-button"
            onClick={() => {
              setView("home");
              setSelectedPet(null);
            }}
          >
            ← 返回首页
          </button>
          <p className="eyebrow">PET PROFILES</p>
          <h1>我的宠物</h1>
          <p>管理宠物资料，并按时间记录健康变化。</p>
        </div>
        <button className="primary-button compact" onClick={openCreatePet}>
          ＋ 新增宠物
        </button>
      </div>
      {petsLoading ? (
        <div className="empty-card">正在加载宠物档案…</div>
      ) : pets.length === 0 ? (
        <div className="empty-card">
          <span>⌁</span>
          <h2>还没有宠物档案</h2>
          <p>创建第一份档案，开始记录它的健康轨迹。</p>
          <button className="primary-button compact" onClick={openCreatePet}>
            创建宠物档案
          </button>
        </div>
      ) : (
        <div className="pet-layout">
          <div className="pet-list">
            {pets.map((pet) => (
              <article
                key={pet.id}
                className={`pet-list-card ${selectedPet?.id === pet.id ? "selected" : ""}`}
                onClick={() => void openPetDetail(pet)}
              >
                <div className="pet-symbol">
                  {pet.species === "CAT"
                    ? "猫"
                    : pet.species === "DOG"
                      ? "犬"
                      : "宠"}
                </div>
                <div>
                  <h3>{pet.name}</h3>
                  <p>
                    {pet.breed || pet.customSpecies || "品种未填写"} ·{" "}
                    {pet.ageText ||
                      (pet.birthDate
                        ? `${pet.birthDate.slice(0, 4)} 年出生`
                        : "年龄未知")}
                  </p>
                </div>
                <span>›</span>
              </article>
            ))}
          </div>
          {selectedPet ? (
            <article className="pet-detail">
              <div className="detail-head">
                <div>
                  <p className="eyebrow">PET DETAIL</p>
                  <h2>{selectedPet.name}</h2>
                  <p>
                    {selectedPet.species === "CAT"
                      ? "猫"
                      : selectedPet.species === "DOG"
                        ? "狗"
                        : selectedPet.customSpecies}{" "}
                    · {selectedPet.breed || "未填写品种"}
                  </p>
                </div>
                <div className="detail-actions">
                  <button onClick={() => openEditPet(selectedPet)}>编辑</button>
                  <button
                    className="danger-text"
                    onClick={() => void removePet(selectedPet)}
                  >
                    停用
                  </button>
                </div>
              </div>
              <dl className="pet-facts">
                <div>
                  <dt>性别</dt>
                  <dd>
                    {selectedPet.gender === "MALE"
                      ? "公"
                      : selectedPet.gender === "FEMALE"
                        ? "母"
                        : "未知"}
                  </dd>
                </div>
                <div>
                  <dt>体重</dt>
                  <dd>
                    {selectedPet.weightKg
                      ? `${selectedPet.weightKg} kg`
                      : "未记录"}
                  </dd>
                </div>
                <div>
                  <dt>绝育</dt>
                  <dd>
                    {selectedPet.neutered == null
                      ? "未知"
                      : selectedPet.neutered
                        ? "是"
                        : "否"}
                  </dd>
                </div>
              </dl>
              <div className="history-head">
                <div>
                  <h3>病史时间线</h3>
                  <p>仅你本人可见，分享时需主动选择。</p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => setHistoryFormOpen(true)}
                >
                  ＋ 记录病史
                </button>
              </div>
              {histories.length === 0 ? (
                <div className="mini-empty">暂无病史记录</div>
              ) : (
                <div className="timeline">
                  {histories.map((item) => (
                    <div className="timeline-item" key={item.id}>
                      <time>{item.recordDate.slice(0, 10)}</time>
                      <div>
                        <h4>{item.title}</h4>
                        <p>{item.description}</p>
                        {(item.hospitalName || item.doctorName) && (
                          <small>
                            {[item.hospitalName, item.doctorName]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        )}
                        {item.treatment && (
                          <small>治疗：{item.treatment}</small>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ) : (
            <div className="pet-detail placeholder-detail">
              选择一只宠物查看完整档案和病史
            </div>
          )}
        </div>
      )}
    </section>
  );
}
