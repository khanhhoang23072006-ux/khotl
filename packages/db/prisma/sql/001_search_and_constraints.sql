-- =====================================================================
-- Phần bổ sung cho migration đầu tiên (Prisma không diễn đạt được).
-- Ở Giai đoạn 1: `prisma migrate dev --create-only`, rồi dán file này
-- vào cuối migration.sql được sinh ra.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extension
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE EXTENSION IF NOT EXISTS vector;  -- Giai đoạn 4 (RAG)

-- ---------------------------------------------------------------------
-- 2. Chuẩn hóa tiếng Việt
-- unaccent() chỉ là STABLE nên không dùng được trong index;
-- bọc lại với từ điển chỉ định rõ để khai báo IMMUTABLE an toàn.
-- Kết quả: chữ thường, bỏ dấu, "đ" → "d".
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vn_norm(input text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT lower(public.unaccent('public.unaccent'::regdictionary, input))
$$;

-- ---------------------------------------------------------------------
-- 3. Vector tìm kiếm của tài liệu
-- Dùng cấu hình 'simple' vì PostgreSQL không có bộ tách từ tiếng Việt;
-- tiếng Việt viết cách âm tiết nên tách theo khoảng trắng vẫn ổn.
-- Trọng số: A = tiêu đề, mã + tên học phần; B = tag, mô tả; D = nội dung.
-- Hàm được worker gọi sau khi tạo/sửa tài liệu, đổi tag, trích xong văn bản.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_document_search(p_document_id text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE documents d
  SET "searchVector" =
        setweight(to_tsvector('simple', vn_norm(coalesce(d.title, ''))), 'A')
     || setweight(to_tsvector('simple', vn_norm(c.code || ' ' || c.name)), 'A')
     || setweight(to_tsvector('simple', vn_norm(coalesce((
          SELECT string_agg(t.name, ' ')
          FROM document_tags dt JOIN tags t ON t.id = dt."tagId"
          WHERE dt."documentId" = d.id), ''))), 'B')
     || setweight(to_tsvector('simple', vn_norm(coalesce(d.description, ''))), 'B')
     || setweight(to_tsvector('simple', vn_norm(left(coalesce((
          SELECT dc.text FROM document_contents dc
          WHERE dc."versionId" = d."currentVersionId"), ''), 200000))), 'D')
  FROM courses c
  WHERE d.id = p_document_id AND c.id = d."courseId";
$$;

-- Vector của học phần: tự cập nhật bằng trigger khi đổi mã/tên.
CREATE OR REPLACE FUNCTION courses_search_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."searchVector" :=
       setweight(to_tsvector('simple', vn_norm(NEW.code)), 'A')
    || setweight(to_tsvector('simple', vn_norm(NEW.name)), 'A')
    || setweight(to_tsvector('simple', vn_norm(coalesce(NEW."nameEn", ''))), 'B');
  RETURN NEW;
END
$$;

CREATE TRIGGER courses_search_update
BEFORE INSERT OR UPDATE OF code, name, "nameEn" ON courses
FOR EACH ROW EXECUTE FUNCTION courses_search_trigger();

-- ---------------------------------------------------------------------
-- 4. Index tìm kiếm
-- GIN trên tsvector cho tìm toàn văn; GIN trigram trên chuỗi đã chuẩn hóa
-- cho gợi ý (autocomplete) và bắt lỗi chính tả nhẹ.
-- ---------------------------------------------------------------------
CREATE INDEX documents_search_idx      ON documents USING gin ("searchVector");
CREATE INDEX documents_title_trgm_idx  ON documents USING gin (vn_norm(title) gin_trgm_ops);
CREATE INDEX courses_search_idx        ON courses   USING gin ("searchVector");
CREATE INDEX courses_name_trgm_idx     ON courses   USING gin (vn_norm(name) gin_trgm_ops);
CREATE INDEX courses_code_trgm_idx     ON courses   USING gin (lower(code) gin_trgm_ops);
CREATE INDEX tags_name_trgm_idx        ON tags      USING gin (vn_norm(name) gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 5. Ràng buộc dữ liệu
-- ---------------------------------------------------------------------
ALTER TABLE ratings        ADD CONSTRAINT ratings_stars_chk        CHECK (stars BETWEEN 1 AND 5);
ALTER TABLE course_reviews ADD CONSTRAINT course_reviews_diff_chk  CHECK (difficulty BETWEEN 1 AND 5);
ALTER TABLE course_reviews ADD CONSTRAINT course_reviews_load_chk  CHECK (workload IS NULL OR workload BETWEEN 1 AND 5);
ALTER TABLE comments       ADD CONSTRAINT comments_depth_chk       CHECK (depth BETWEEN 0 AND 2);
ALTER TABLE users          ADD CONSTRAINT users_trust_level_chk    CHECK ("trustLevel" BETWEEN 0 AND 3);

-- Tài liệu nhóm phải gắn với nhóm, tài liệu công khai thì không.
ALTER TABLE documents ADD CONSTRAINT documents_group_visibility_chk
  CHECK ((visibility = 'GROUP') = ("groupId" IS NOT NULL));

-- Mã kỳ dạng 5 chữ số, vd 20251.
ALTER TABLE documents ADD CONSTRAINT documents_term_chk
  CHECK (term IS NULL OR term ~ '^[0-9]{4}[1-3]$');

-- Báo cáo phải trỏ tới ít nhất một đối tượng.
ALTER TABLE reports ADD CONSTRAINT reports_target_chk
  CHECK (num_nonnulls("documentId", "commentId", "messageId", "directMessageId", "reportedUserId") >= 1);

-- Mỗi cặp người dùng chỉ một cuộc trò chuyện riêng.
ALTER TABLE direct_conversations ADD CONSTRAINT dm_pair_order_chk
  CHECK ("userAId" < "userBId");

-- Vai trò toàn hệ thống (facultyId NULL) không được trùng.
CREATE UNIQUE INDEX user_roles_global_uniq
  ON user_roles ("userId", "roleId") WHERE "facultyId" IS NULL;

-- ---------------------------------------------------------------------
-- 6. AuditLog chỉ được ghi thêm
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_logs_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs chỉ được ghi thêm, không được sửa hoặc xóa';
END
$$;

CREATE TRIGGER audit_logs_no_update_delete
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
