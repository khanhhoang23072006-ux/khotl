import "server-only";
import { type SearchQuery, toPrefixTsQuery } from "@khotl/core";
import { Prisma, prisma } from "@khotl/db";
import { queryTerms } from "./highlight";

export const PAGE_SIZE = 20;

export interface SearchHit {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: string;
  term: string | null;
  courseCode: string;
  courseName: string;
  fileKind: string | null;
  pageCount: number | null;
  sizeBytes: bigint | null;
  downloadCount: number;
  ratingCount: number;
  ratingSum: number;
  publishedAt: Date | null;
  snippet: string | null;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  /** true khi không có kết quả khớp chính xác và đang hiện kết quả gần đúng (lỗi chính tả) */
  fuzzy: boolean;
  terms: string[];
}

interface Row extends SearchHit {
  total: bigint;
}

/** Truy vấn có toán tử của websearch (cụm từ trong ngoặc kép, dấu trừ, OR) thì giữ nguyên cú pháp. */
function hasOperators(q: string): boolean {
  return /"|(^|\s)-\S|\sor\s/i.test(q);
}

function filterSql(query: SearchQuery): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`d.status = 'APPROVED'::"DocumentStatus"`,
    Prisma.sql`d.visibility = 'PUBLIC'::"DocumentVisibility"`,
    Prisma.sql`d."deletedAt" IS NULL`,
  ];
  if (query.faculty) parts.push(Prisma.sql`f.slug = ${query.faculty}`);
  if (query.course) parts.push(Prisma.sql`c.code = ${query.course.toUpperCase()}`);
  if (query.type) parts.push(Prisma.sql`d.type = ${query.type}::"DocumentType"`);
  if (query.term) parts.push(Prisma.sql`d.term = ${query.term}`);
  if (query.format) parts.push(Prisma.sql`v."fileKind" = ${query.format}::"FileKind"`);
  return Prisma.join(parts, " AND ");
}

/** Thứ tự sắp xếp; `score` là cột điểm liên quan của truy vấn trong. */
function orderSql(query: SearchQuery, hasText: boolean, alias: "d" | "m"): Prisma.Sql {
  const col = (name: string) => Prisma.raw(`${alias}."${name}"`);
  switch (query.sort) {
    case "newest":
      return Prisma.sql`${col("publishedAt")} DESC NULLS LAST, ${col("id")} DESC`;
    case "popular":
      return Prisma.sql`${col("downloadCount")} DESC, ${col("publishedAt")} DESC NULLS LAST`;
    case "rating":
      return Prisma.sql`${col("ratingScore")} DESC, ${col("ratingCount")} DESC`;
    default:
      return hasText
        ? Prisma.sql`${Prisma.raw(alias === "m" ? 'm."score"' : "score")} DESC, ${col("publishedAt")} DESC NULLS LAST`
        : Prisma.sql`${col("publishedAt")} DESC NULLS LAST, ${col("id")} DESC`;
  }
}

const FROM = Prisma.sql`
  FROM documents d
  JOIN courses c ON c.id = d."courseId"
  JOIN faculties f ON f.id = c."facultyId"
  LEFT JOIN document_versions v ON v.id = d."currentVersionId"`;

/** Lấy thông tin hiển thị và đoạn trích nội dung cho các tài liệu đã chọn ở truy vấn trong. */
async function fetchHits(
  inner: Prisma.Sql,
  order: Prisma.Sql,
  snippetTerm: string,
): Promise<{ rows: SearchHit[]; total: number }> {
  const rows = await prisma.$queryRaw<Row[]>`
    WITH m AS (${inner})
    SELECT m.total, d.id, d.slug, d.title, d.description, d.type::text AS type, d.term,
           c.code AS "courseCode", c.name AS "courseName",
           v."fileKind"::text AS "fileKind", v."pageCount", v."sizeBytes",
           d."downloadCount", d."ratingCount", d."ratingSum", d."publishedAt",
           s.snippet
    FROM m
    JOIN documents d ON d.id = m.id
    JOIN courses c ON c.id = d."courseId"
    LEFT JOIN document_versions v ON v.id = d."currentVersionId"
    LEFT JOIN LATERAL (
      SELECT CASE WHEN p.pos > 0
                  THEN substring(dc.text FROM greatest(p.pos - 90, 1) FOR 260)
             END AS snippet
      FROM document_contents dc
      CROSS JOIN LATERAL (
        SELECT CASE WHEN ${snippetTerm} = '' THEN 0
                    ELSE strpos(vn_norm(left(dc.text, 200000)), ${snippetTerm}) END AS pos
      ) p
      WHERE dc."versionId" = d."currentVersionId"
    ) s ON true
    ORDER BY ${order}`;
  const total = rows[0] ? Number(rows[0].total) : 0;
  return { rows: rows.map(({ total: _total, ...hit }) => hit), total };
}

/**
 * Tìm tài liệu đã duyệt. Thứ tự thử:
 * 1. Toàn văn trên searchVector (tiêu đề, học phần, tag, mô tả, nội dung đã bỏ dấu), gõ dở từ vẫn khớp nhờ tiền tố.
 * 2. Không có kết quả thì dùng trigram trên tiêu đề để bắt lỗi chính tả ("giai tihc").
 * Tiêu đề có dấu trùng nguyên văn truy vấn được cộng điểm, nên gõ có dấu cho kết quả chính xác hơn.
 */
export async function searchDocuments(query: SearchQuery): Promise<SearchResult> {
  const q = query.q.trim();
  const offset = (query.page - 1) * PAGE_SIZE;
  const terms = queryTerms(q);
  const snippetTerm = terms[0] ?? "";
  const where = filterSql(query);

  const tsquery = !q
    ? null
    : hasOperators(q)
      ? Prisma.sql`websearch_to_tsquery('simple', vn_norm(${q}))`
      : (() => {
          const prefix = toPrefixTsQuery(q);
          return prefix ? Prisma.sql`to_tsquery('simple', ${prefix})` : null;
        })();

  if (!tsquery) {
    const inner = Prisma.sql`
      SELECT d.id, d."publishedAt", d."downloadCount", d."ratingScore", d."ratingCount",
             0::float AS score, count(*) OVER() AS total
      ${FROM}
      WHERE ${where}
      ORDER BY ${orderSql(query, false, "d")}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
    const { rows, total } = await fetchHits(inner, orderSql(query, false, "m"), "");
    return { hits: rows, total, fuzzy: false, terms: [] };
  }

  const exact = Prisma.sql`
    SELECT d.id, d."publishedAt", d."downloadCount", d."ratingScore", d."ratingCount",
           ts_rank_cd(d."searchVector", q.tsq, 1)
             + CASE WHEN strpos(lower(d.title), lower(${q})) > 0 THEN 0.5 ELSE 0 END AS score,
           count(*) OVER() AS total
    ${FROM}
    CROSS JOIN (SELECT ${tsquery} AS tsq) q
    WHERE ${where} AND d."searchVector" @@ q.tsq
    ORDER BY ${orderSql(query, true, "d")}
    LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  const exactResult = await fetchHits(exact, orderSql(query, true, "m"), snippetTerm);
  if (exactResult.total > 0 || query.page > 1) {
    return { hits: exactResult.rows, total: exactResult.total, fuzzy: false, terms };
  }

  const fuzzy = Prisma.sql`
    SELECT d.id, d."publishedAt", d."downloadCount", d."ratingScore", d."ratingCount",
           word_similarity(vn_norm(${q}), vn_norm(d.title)) AS score,
           count(*) OVER() AS total
    ${FROM}
    WHERE ${where} AND vn_norm(${q}) <% vn_norm(d.title)
    ORDER BY score DESC
    LIMIT ${PAGE_SIZE}`;
  const fuzzyResult = await fetchHits(fuzzy, Prisma.sql`m."score" DESC`, "");
  return { hits: fuzzyResult.rows, total: fuzzyResult.total, fuzzy: fuzzyResult.total > 0, terms };
}

export interface CourseHit {
  id: string;
  code: string;
  name: string;
  documentCount: number;
  facultyShortName: string | null;
}

/** Học phần khớp theo mã (tiền tố) hoặc tên (không dấu, có bắt lỗi chính tả). */
export async function searchCourses(q: string, limit = 5): Promise<CourseHit[]> {
  const text = q.trim();
  if (!text) return [];
  const prefix = toPrefixTsQuery(text);
  const codePrefix = `${text.replace(/\s+/g, "").toLowerCase().replace(/[%_\\]/g, "")}%`;
  return prisma.$queryRaw<CourseHit[]>`
    SELECT c.id, c.code, c.name, c."documentCount", f."shortName" AS "facultyShortName"
    FROM courses c
    JOIN faculties f ON f.id = c."facultyId"
    WHERE lower(c.code) LIKE ${codePrefix}
       ${prefix ? Prisma.sql`OR c."searchVector" @@ to_tsquery('simple', ${prefix})` : Prisma.empty}
       OR vn_norm(${text}) <% vn_norm(c.name)
    ORDER BY (lower(c.code) = lower(${text})) DESC,
             (lower(c.code) LIKE ${codePrefix}) DESC,
             c."documentCount" DESC, c.code
    LIMIT ${limit}`;
}

export interface TitleSuggestion {
  slug: string;
  title: string;
  courseCode: string;
}

/** Gợi ý tiêu đề tài liệu khi đang gõ (ưu tiên khớp tiêu đề, sau đó lượt tải). */
export async function suggestTitles(q: string, limit = 5): Promise<TitleSuggestion[]> {
  const prefix = toPrefixTsQuery(q);
  if (!prefix) return [];
  return prisma.$queryRaw<TitleSuggestion[]>`
    SELECT d.slug, d.title, c.code AS "courseCode"
    FROM documents d
    JOIN courses c ON c.id = d."courseId"
    WHERE d.status = 'APPROVED'::"DocumentStatus"
      AND d.visibility = 'PUBLIC'::"DocumentVisibility"
      AND d."deletedAt" IS NULL
      AND d."searchVector" @@ to_tsquery('simple', ${prefix})
    ORDER BY ts_rank(d."searchVector", to_tsquery('simple', ${prefix}), 1) DESC,
             d."downloadCount" DESC
    LIMIT ${limit}`;
}
