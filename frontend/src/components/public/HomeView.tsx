import { type SessionData, type PublicView } from "../../shared";

type Props = {
  session: SessionData;
  setView: (view: PublicView) => void;
  openCreatePet: () => void;
};

export default function HomeView({ session, setView, openCreatePet }: Props) {
  return (
    <>
      <section className="welcome-section">
        <div>
          <p className="eyebrow">GOOD TO SEE YOU</p>
          <h1>你好，{session.user.nickname}</h1>
          <p>从宠物健康档案开始，建立属于你和它的长期健康轨迹。</p>
        </div>
        <button
          className="primary-button compact"
          onClick={() => {
            setView("pets");
            openCreatePet();
          }}
        >
          ＋ 添加宠物
        </button>
      </section>
      <section className="dashboard-grid">
        <article className="dashboard-card featured">
          <span className="card-icon">⌁</span>
          <div>
            <p className="eyebrow">HEALTH PROFILE</p>
            <h2>管理宠物健康档案</h2>
            <p>记录基础信息、疫苗、驱虫和每一次健康变化。</p>
          </div>
          <button className="link-button" onClick={() => setView("pets")}>
            查看我的宠物 →
          </button>
        </article>
        <article className="dashboard-card">
          <span className="card-icon cool">?</span>
          <div>
            <h3>健康问答</h3>
            <p>向认证宠物医生提出健康问题。</p>
          </div>
          <button className="link-button">查看问答 →</button>
        </article>
        <article className="dashboard-card">
          <span className="card-icon warm">♢</span>
          <div>
            <h3>专业身份认证</h3>
            <p>医生与医生助理可申请专业认证。</p>
          </div>
          <button
            className="link-button"
            onClick={() => setView("professional")}
          >
            了解认证 →
          </button>
        </article>
      </section>
    </>
  );
}
