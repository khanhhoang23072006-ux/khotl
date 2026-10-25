// Seed dữ liệu mẫu. Chạy: pnpm db:seed (cần Postgres và kho S3 đang chạy).
// Chạy lại nhiều lần được: danh mục dùng upsert, tài liệu mẫu chỉ tạo khi kho còn trống.
import { randomUUID } from "node:crypto";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: [".env", "../../.env"] });

const { getStorage } = await import("@khotl/adapters");
const { ROLE_PERMISSIONS, slugify } = await import("@khotl/core");
const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
const { prisma } = await import("../src/client");
const { COURSES, COURSES_WITH_DOCUMENTS, DEFAULT_BANNED_WORDS, DOCUMENT_TEMPLATES, FACULTIES } =
  await import("./seed-data");

/** Bộ sinh số giả ngẫu nhiên cố định để dữ liệu mẫu giống nhau mỗi lần seed. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
const random = createRandom(20251);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;

/** Font chuẩn của PDF (WinAnsi) không có dấu tiếng Việt, nên nội dung PDF mẫu dùng chữ không dấu. */
function ascii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7e]/g, " ");
}

async function seedRoles() {
  for (const [key, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const name = key === "STUDENT" ? "Sinh viên" : key === "MODERATOR" ? "Kiểm duyệt viên" : "Quản trị viên";
    await prisma.role.upsert({
      where: { key: key as "STUDENT" | "MODERATOR" | "ADMIN" },
      create: { key: key as "STUDENT" | "MODERATOR" | "ADMIN", name, permissions: [...permissions] },
      update: { name, permissions: [...permissions] },
    });
  }
}

async function seedCatalog() {
  for (const [index, faculty] of FACULTIES.entries()) {
    await prisma.faculty.upsert({
      where: { code: faculty.code },
      create: { ...faculty, slug: slugify(faculty.code), sortOrder: index },
      update: { name: faculty.name, nameEn: faculty.nameEn, shortName: faculty.shortName, sortOrder: index },
    });
  }
  const faculties = await prisma.faculty.findMany({ select: { id: true, code: true } });
  const facultyId = new Map(faculties.map((faculty) => [faculty.code, faculty.id]));

  for (const course of COURSES) {
    const data = {
      name: course.name,
      nameEn: course.nameEn,
      credits: course.credits,
      facultyId: facultyId.get(course.faculty) as string,
      gradingScheme: [
        { label: "Quá trình", weight: course.credits >= 3 ? 0.4 : 0.3 },
        { label: "Cuối kỳ", weight: course.credits >= 3 ? 0.6 : 0.7 },
      ],
    };
    await prisma.course.upsert({
      where: { code: course.code },
      create: { code: course.code, slug: course.code.toLowerCase(), ...data },
      update: data,
    });
  }
}

async function seedSettings() {
  await prisma.systemSetting.upsert({
    where: { key: "moderation.bannedWords" },
    create: {
      key: "moderation.bannedWords",
      value: DEFAULT_BANNED_WORDS,
      description: "Từ cấm trong tài liệu và chat (so khớp không dấu)",
    },
    update: {},
  });
}

interface DemoUser {
  email: string;
  name: string;
  username: string;
  role: "STUDENT" | "MODERATOR" | "ADMIN";
}

const DEMO_USERS: DemoUser[] = [
  { email: "sv.demo@sis.hust.edu.vn", name: "Sinh viên Demo", username: "sv.demo", role: "STUDENT" },
  { email: "kdv.demo@hust.edu.vn", name: "Kiểm duyệt viên Demo", username: "kdv.demo", role: "MODERATOR" },
  { email: "admin.demo@hust.edu.vn", name: "Quản trị Demo", username: "admin.demo", role: "ADMIN" },
];

async function seedUsers(): Promise<string | null> {
  if (process.env.SEED_DEMO_USERS === "false") return null;
  const soict = await prisma.faculty.findUniqueOrThrow({ where: { code: "SOICT" } });
  const roles = await prisma.role.findMany();
  let uploaderId: string | null = null;

  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      create: {
        email: demo.email,
        name: demo.name,
        username: demo.username,
        emailVerified: true,
        facultyId: soict.id,
        cohort: 68,
        trustLevel: demo.role === "STUDENT" ? 1 : 2,
      },
      update: {},
    });
    const keys = demo.role === "STUDENT" ? ["STUDENT"] : ["STUDENT", demo.role];
    for (const key of keys) {
      const role = roles.find((candidate) => candidate.key === key);
      if (!role) continue;
      const existing = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: role.id, facultyId: null },
      });
      if (!existing) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }
    if (demo.role === "STUDENT") uploaderId = user.id;
  }
  return uploaderId;
}

async function makePdf(title: string, courseCode: string, courseName: string, keywords: string[]) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(ascii(title));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageCount = 3 + Math.floor(random() * 3);

  for (let p = 1; p <= pageCount; p++) {
    const page = pdf.addPage([595, 842]);
    let y = 790;
    page.drawRectangle({ x: 40, y: 40, width: 515, height: 762, borderWidth: 1.5, borderColor: rgb(0.1, 0.12, 0.14) });
    if (p === 1) {
      page.drawText("DAI HOC BACH KHOA HA NOI - TAI LIEU MAU", { x: 60, y, size: 11, font: bold });
      y -= 30;
      page.drawText(ascii(title).slice(0, 70), { x: 60, y, size: 15, font: bold });
      y -= 22;
      page.drawText(`${courseCode} - ${ascii(courseName)}`, { x: 60, y, size: 12, font });
      y -= 34;
    }
    for (let line = 0; line < 18; line++) {
      const keyword = keywords[(line + p) % keywords.length] ?? "noi dung";
      const text = `Cau ${p}.${line + 1}. Trinh bay ve ${keyword} va ap dung vao bai tap ${courseCode}.`;
      page.drawText(text, { x: 60, y, size: 11, font, color: rgb(0.15, 0.17, 0.2) });
      y -= 20;
    }
    page.drawText(`Trang ${p}/${pageCount} - Du lieu mau de demo, khong phai tai lieu that.`, {
      x: 60,
      y: 60,
      size: 9,
      font,
      color: rgb(0.4, 0.42, 0.45),
    });
  }
  return { bytes: await pdf.save(), pageCount };
}

async function seedDocuments(uploaderId: string | null) {
  if (!uploaderId) {
    console.log("Bỏ qua tài liệu mẫu vì SEED_DEMO_USERS=false");
    return;
  }
  if ((await prisma.document.count()) > 0) {
    console.log("Đã có tài liệu, bỏ qua bước tạo tài liệu mẫu");
    return;
  }

  const storage = getStorage();
  const bucket = await storage.ensureBucket([process.env.APP_URL ?? "http://localhost:3000"]);
  if (bucket.corsError) console.warn(`Không đặt được CORS cho bucket: ${bucket.corsError}`);

  const terms = ["20231", "20232", "20241", "20242", "20251"];
  const courses = await prisma.course.findMany({ where: { code: { in: COURSES_WITH_DOCUMENTS } } });
  let created = 0;

  for (const course of courses) {
    const seed = COURSES.find((candidate) => candidate.code === course.code);
    const templates = [...DOCUMENT_TEMPLATES].sort(() => random() - 0.5).slice(0, 2 + Math.floor(random() * 3));
    for (const [index, template] of templates.entries()) {
      const term = pick(terms);
      const title = template.title(course.name, term, index + 1);
      const { bytes, pageCount } = await makePdf(title, course.code, course.name, seed?.keywords ?? []);
      const storageKey = `originals/seed/${course.code.toLowerCase()}-${randomUUID()}.pdf`;
      await storage.put(storageKey, bytes, "application/pdf");

      const publishedAt = new Date(Date.now() - Math.floor(random() * 120) * 86_400_000);
      const downloads = Math.floor(random() * 2500);
      await prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            slug: `${slugify(title)}-${randomUUID().slice(0, 6)}`,
            title,
            description: template.description,
            type: template.type,
            status: "APPROVED",
            courseId: course.id,
            uploaderId,
            term,
            academicYear: Number(term.slice(0, 4)),
            copyrightAcceptedAt: publishedAt,
            publishedAt,
            createdAt: publishedAt,
            viewCount: downloads * 3 + Math.floor(random() * 200),
            downloadCount: downloads,
          },
        });
        const version = await tx.documentVersion.create({
          data: {
            documentId: document.id,
            versionNumber: 1,
            originalName: `${slugify(title)}.pdf`,
            storageKey,
            fileKind: "PDF",
            declaredMime: "application/pdf",
            sizeBytes: BigInt(bytes.length),
            pageCount,
            previewPdfKey: storageKey,
            // Worker sẽ sinh ảnh xem trước, trích văn bản và cập nhật tìm kiếm
            processingStatus: "QUEUED",
            uploadedAt: publishedAt,
          },
        });
        await tx.document.update({ where: { id: document.id }, data: { currentVersionId: version.id } });
      });
      created++;
    }
  }

  // Cập nhật vector tìm kiếm ngay theo tiêu đề và học phần (worker bổ sung nội dung sau)
  await prisma.$executeRaw`SELECT refresh_document_search(id) FROM documents`;
  await prisma.$executeRaw`
    UPDATE courses c SET "documentCount" = (
      SELECT count(*) FROM documents d WHERE d."courseId" = c.id AND d.status = 'APPROVED'
    )`;
  await prisma.user.update({
    where: { id: uploaderId },
    data: { approvedDocumentCount: created, reputation: created * 10 },
  });
  console.log(`Đã tạo ${created} tài liệu mẫu`);
}

async function main() {
  await seedRoles();
  await seedCatalog();
  await seedSettings();
  const uploaderId = await seedUsers();
  // Mặc định không tạo tài liệu mẫu; muốn tạo lại: SEED_SAMPLE_DOCUMENTS=true pnpm db:seed
  if (process.env.SEED_SAMPLE_DOCUMENTS === "true") await seedDocuments(uploaderId);
  console.log("Seed xong");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
