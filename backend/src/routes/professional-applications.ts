import {
  app,
  prisma,
  lockUser,
  pushAdminNotification,
  sendError,
  currentSession,
  csrfValid,
  nullableText,
  AdminNotificationType,
  AdminStatus,
  ApplicationPurpose,
  ApplicationStatus,
  ProfessionalStatus,
  ProfessionalType,
} from "../context.js";

app.post("/api/v1/professional-applications", async (request, response) => {
  const session = await currentSession(request);
  if (!session) return sendError(response, 401, "UNAUTHENTICATED", "请先登录");
  if (!csrfValid(request, session))
    return sendError(
      response,
      403,
      "CSRF_INVALID",
      "安全校验失败，请刷新页面后重试",
    );
  const requestedType = Object.values(ProfessionalType).includes(
    request.body?.requestedType as ProfessionalType,
  )
    ? (request.body.requestedType as ProfessionalType)
    : null;
  const realName = nullableText(request.body?.realName, 80);
  const displayName = nullableText(request.body?.displayName, 80);
  const organization = nullableText(request.body?.organization, 150);
  const yearsOfPractice = Number(request.body?.yearsOfPractice);
  const specialties = Array.isArray(request.body?.specialties)
    ? request.body.specialties
        .filter((item: unknown) => typeof item === "string" && item.trim())
        .map((item: string) => item.trim().slice(0, 40))
        .slice(0, 10)
    : [];
  const credentialMediaId = Number(request.body?.credentialMediaId);
  if (
    !requestedType ||
    !realName ||
    !displayName ||
    !organization ||
    !Number.isInteger(yearsOfPractice) ||
    yearsOfPractice < 0 ||
    yearsOfPractice > 80 ||
    specialties.length === 0 ||
    !Number.isInteger(credentialMediaId)
  )
    return sendError(
      response,
      400,
      "VALIDATION_ERROR",
      "请完整填写认证资料、擅长领域和证明材料",
    );
  const credential = await prisma.mediaAsset.findFirst({
    where: {
      id: credentialMediaId,
      uploaderId: session.userId,
      deletedAt: null,
    },
  });
  if (!credential)
    return sendError(
      response,
      400,
      "INVALID_CREDENTIAL_MEDIA",
      "证明材料不存在或不属于当前用户",
    );
  const result = await prisma.$transaction(async (transaction) => {
    await lockUser(transaction, session.userId);
    const [pending, profile] = await Promise.all([
      transaction.professionalApplication.findFirst({
        where: { userId: session.userId, status: ApplicationStatus.PENDING },
      }),
      transaction.professionalProfile.findUnique({
        where: { userId: session.userId },
      }),
    ]);
    if (pending) return { error: "APPLICATION_PENDING" as const };
    if (
      profile?.status === ProfessionalStatus.APPROVED &&
      (profile.type !== ProfessionalType.ASSISTANT ||
        requestedType !== ProfessionalType.VETERINARIAN)
    )
      return { error: "INVALID_IDENTITY_CHANGE" as const };
    if (profile?.status === ProfessionalStatus.REVOKED)
      return { error: "IDENTITY_REVOKED" as const };
    const purpose =
      profile?.status === ProfessionalStatus.APPROVED
        ? ApplicationPurpose.UPGRADE
        : ApplicationPurpose.INITIAL;
    const application = await transaction.professionalApplication.create({
      data: {
        userId: session.userId,
        requestedType,
        purpose,
        previousType:
          purpose === ApplicationPurpose.UPGRADE
            ? ProfessionalType.ASSISTANT
            : null,
        realName,
        displayName,
        organization,
        yearsOfPractice,
        specialties,
        introduction: nullableText(request.body?.introduction, 1000),
        credentialMediaId,
      },
    });
    const admins = await transaction.adminUser.findMany({
      where: { status: AdminStatus.ACTIVE },
      select: { id: true },
    });
    const adminNotifications = [];
    for (const admin of admins)
      adminNotifications.push(
        await transaction.adminNotification.create({
          data: {
            adminUserId: admin.id,
            type: AdminNotificationType.PROFESSIONAL_APPLICATION_SUBMITTED,
            title:
              purpose === ApplicationPurpose.UPGRADE
                ? "新的医生助理升级申请"
                : "新的专业认证申请",
            content: `${displayName}提交了${purpose === ApplicationPurpose.UPGRADE ? "医生助理升级宠物医生" : requestedType === ProfessionalType.VETERINARIAN ? "宠物医生" : "医生助理"}认证申请，请及时审核。`,
            link: "/admin#applications",
          },
        }),
      );
    return { application, adminNotifications };
  });
  if ("error" in result)
    return sendError(
      response,
      409,
      result.error ?? "STATUS_CONFLICT",
      result.error === "APPLICATION_PENDING"
        ? "已有审核中的申请，请勿重复提交"
        : result.error === "IDENTITY_REVOKED"
          ? "当前专业身份已撤销，请走重新认证流程"
          : "当前身份不允许提交该认证申请",
    );
  result.adminNotifications.forEach((notification) =>
    pushAdminNotification(notification.adminUserId, notification),
  );
  return response.status(201).json({ data: result.application });
});

app.post(
  "/api/v1/professional-applications/:applicationId/cancel",
  async (request, response) => {
    const session = await currentSession(request);
    if (!session)
      return sendError(response, 401, "UNAUTHENTICATED", "请先登录");
    if (!csrfValid(request, session))
      return sendError(
        response,
        403,
        "CSRF_INVALID",
        "安全校验失败，请刷新页面后重试",
      );
    const applicationId = Number(request.params.applicationId);
    if (!Number.isInteger(applicationId))
      return sendError(response, 404, "RESOURCE_NOT_FOUND", "待审核申请不存在");
    const result = await prisma.$transaction(async (transaction) => {
      await lockUser(transaction, session.userId);
      const application = await transaction.professionalApplication.findFirst({
        where: {
          id: applicationId,
          userId: session.userId,
          status: ApplicationStatus.PENDING,
        },
      });
      if (!application) return null;
      await transaction.professionalApplication.update({
        where: { id: application.id },
        data: { status: ApplicationStatus.CANCELLED },
      });
      const admins = await transaction.adminUser.findMany({
        where: { status: AdminStatus.ACTIVE },
        select: { id: true },
      });
      const adminNotifications = [];
      for (const admin of admins)
        adminNotifications.push(
          await transaction.adminNotification.create({
            data: {
              adminUserId: admin.id,
              type: AdminNotificationType.PROFESSIONAL_APPLICATION_CANCELLED,
              title: "认证申请已撤回",
              content: `${application.displayName}撤回了${application.purpose === ApplicationPurpose.UPGRADE ? "医生助理升级宠物医生" : "专业身份"}申请。`,
              link: "/admin#applications",
            },
          }),
        );
      return adminNotifications;
    });
    if (!result)
      return sendError(
        response,
        409,
        "APPLICATION_NOT_PENDING",
        "申请已处理或不存在，请刷新后重试",
      );
    result.forEach((notification) =>
      pushAdminNotification(notification.adminUserId, notification),
    );
    return response.status(204).send();
  },
);
