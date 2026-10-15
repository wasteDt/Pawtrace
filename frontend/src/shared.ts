export type User = {
  id: number;
  nickname: string | null;
  avatarUrl: string | null;
  profileCompleted: boolean;
};
export type SessionData = { csrfToken: string; user: User };
export type ApiError = { error?: { message?: string } };
export type Pet = {
  id: number;
  name: string;
  species: "CAT" | "DOG" | "OTHER";
  customSpecies: string | null;
  breed: string | null;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  birthDate: string | null;
  ageText: string | null;
  weightKg: number | null;
  neutered: boolean | null;
  allergies: string | null;
  pastDiseases: string | null;
  vaccinationInfo: string | null;
  dewormingInfo: string | null;
  note: string | null;
};
export type History = {
  id: number;
  recordDate: string;
  title: string;
  description: string;
  hospitalName: string | null;
  doctorName: string | null;
  treatment: string | null;
};
export type PetDraft = Omit<Pet, "id">;
export type PublicView = "home" | "pets" | "professional" | "social";
export type ProfessionalDraft = {
  requestedType: "VETERINARIAN" | "ASSISTANT";
  realName: string;
  displayName: string;
  organization: string;
  yearsOfPractice: string;
  specialties: string;
  introduction: string;
};
export type HistoryDraft = {
  recordDate: string;
  title: string;
  description: string;
  hospitalName: string;
  doctorName: string;
  treatment: string;
};
export type NotificationFilter = "all" | "unread" | "professional" | "system";
export type ProfessionalApplication = {
  id: number;
  requestedType: "VETERINARIAN" | "ASSISTANT";
  purpose: "INITIAL" | "UPGRADE";
  previousType: "VETERINARIAN" | "ASSISTANT" | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  displayName: string;
  organization: string;
  reviewNote: string | null;
  submittedAt: string;
  credentialMedia: { id: number; originalName: string };
};
export type ProfessionalState = {
  profile: {
    type: "VETERINARIAN" | "ASSISTANT";
    status: string;
    realName: string;
    displayName: string;
    organization: string;
    yearsOfPractice: number;
    specialties: string[];
    introduction: string | null;
  } | null;
  application: ProfessionalApplication | null;
};
export type AdminSession = {
  csrfToken: string;
  admin: { id: number; username: string; displayName: string };
};
export type AdminApplication = ProfessionalApplication & {
  realName: string;
  yearsOfPractice: number;
  specialties: string[];
  introduction: string | null;
  reviewedAt: string | null;
  user: {
    id: number;
    phoneNumber: string;
    profile: { nickname: string | null } | null;
    professional: { type: "VETERINARIAN" | "ASSISTANT"; status: string } | null;
  };
  credentialMedia: {
    id: number;
    originalName: string;
    mimeType: string;
    sizeBytes: string | number;
  };
  reviewedBy: { displayName: string } | null;
};
export type AdminPage =
  | "dashboard"
  | "notifications"
  | "applications"
  | "professionals"
  | "users"
  | "content"
  | "reports"
  | "operations"
  | "audit"
  | "settings";
export type AdminDashboard = {
  pendingApplications: number;
  approvedProfessionals: number;
  revokedProfessionals: number;
  todayActions: number;
};
export type AdminProfessional = {
  id: number;
  userId: number;
  type: "VETERINARIAN" | "ASSISTANT";
  status: "APPROVED" | "REVOKED";
  realName: string;
  displayName: string;
  organization: string;
  yearsOfPractice: number;
  specialties: string[];
  approvedAt: string | null;
  revokedAt: string | null;
  user: {
    id: number;
    phoneNumber: string;
    profile: { nickname: string | null } | null;
    applications: Array<{
      id: number;
      requestedType: string;
      status: string;
      submittedAt: string;
      reviewedAt: string | null;
      reviewNote: string | null;
    }>;
  };
};
export type AuditLog = {
  id: number;
  action: string;
  targetType: string;
  targetId: number;
  reason: string | null;
  createdAt: string;
  adminUser: { displayName: string };
};
export type Notification = {
  id: number;
  type: string;
  title: string;
  content: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};
export const emptyPet: PetDraft = {
  name: "",
  species: "CAT",
  customSpecies: null,
  breed: null,
  gender: "UNKNOWN",
  birthDate: null,
  ageText: "",
  weightKg: null,
  neutered: null,
  allergies: null,
  pastDiseases: null,
  vaccinationInfo: null,
  dewormingInfo: null,
  note: null,
};
export const rejectionReasons = [
  "证明材料不清晰或关键信息无法辨认，请重新上传清晰完整的材料。",
  "提交的证明材料与申请身份不匹配，请核对后重新申请。",
  "证明材料信息不完整，请补充包含姓名、证书编号等关键信息的页面。",
  "申请资料中的姓名或所属机构与证明材料不一致，请修改后重新提交。",
  "证明材料已过期或无法确认有效性，请上传当前有效的证明。",
];
export const adminPageNames: Record<AdminPage, string> = {
  dashboard: "工作台",
  notifications: "通知中心",
  applications: "认证申请",
  professionals: "已认证人员",
  users: "用户管理",
  content: "内容治理",
  reports: "举报中心",
  operations: "运营管理",
  audit: "审计日志",
  settings: "系统设置",
};

export async function json<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & ApiError;
  if (!response.ok)
    throw new Error(body.error?.message ?? "请求失败，请稍后重试");
  return body;
}
