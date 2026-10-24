import { createWriteStream } from "node:fs";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Lưu file qua S3 API. Cùng một code chạy với Cloudflare R2 (cloud) và SeaweedFS (self-host);
 * chỉ khác biến môi trường.
 */
export interface StorageConfig {
  /** Địa chỉ server dùng để đọc/ghi (vd http://s3:8333 trong Docker) */
  endpoint?: string;
  /** Địa chỉ trình duyệt dùng với URL ký sẵn (vd http://localhost:8333) */
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function storageConfigFromEnv(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const bucket = env.S3_BUCKET;
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Thiếu cấu hình lưu file: S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY");
  }
  return {
    endpoint: env.S3_ENDPOINT || undefined,
    publicEndpoint: env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT || undefined,
    region: env.S3_REGION || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
  };
}

export interface PresignGetOptions {
  expiresIn?: number;
  /** Tên file gợi ý khi tải về (có dấu tiếng Việt vẫn được) */
  downloadName?: string;
  /** true: mở trong trình duyệt (dùng cho pdf.js), false: luôn tải về */
  inline?: boolean;
  contentType?: string;
}

export class Storage {
  readonly bucket: string;
  private readonly client: S3Client;
  private readonly signer: S3Client;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    const credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials,
    });
    // URL ký sẵn phải mang host mà trình duyệt truy cập được, vì host nằm trong chữ ký.
    this.signer =
      config.publicEndpoint && config.publicEndpoint !== config.endpoint
        ? new S3Client({
            region: config.region,
            endpoint: config.publicEndpoint,
            forcePathStyle: config.forcePathStyle,
            credentials,
          })
        : this.client;
  }

  /** URL để trình duyệt PUT file thẳng lên kho; trình duyệt phải gửi đúng Content-Type này. */
  presignPut(key: string, contentType: string, expiresIn = 600): Promise<string> {
    return getSignedUrl(
      this.signer,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    );
  }

  presignGet(key: string, options: PresignGetOptions = {}): Promise<string> {
    const disposition = options.downloadName
      ? contentDisposition(options.downloadName, options.inline ?? false)
      : options.inline
        ? "inline"
        : undefined;
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: disposition,
        ResponseContentType: options.contentType,
      }),
      { expiresIn: options.expiresIn ?? 300 },
    );
  }

  async head(key: string): Promise<{ size: number; contentType?: string } | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: result.ContentLength ?? 0, contentType: result.ContentType };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async getBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error(`Không đọc được object ${key}`);
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async downloadToFile(key: string, filePath: string): Promise<void> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error(`Không đọc được object ${key}`);
    await pipeline(result.Body as Readable, createWriteStream(filePath));
  }

  async put(
    key: string,
    body: Buffer | Uint8Array,
    contentType: string,
    cacheControl?: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Tạo bucket nếu chưa có và đặt CORS để trình duyệt upload/tải trực tiếp.
   * Với R2, CORS nên cấu hình trên dashboard; lỗi đặt CORS ở đây chỉ ghi cảnh báo.
   */
  async ensureBucket(allowedOrigins: string[]): Promise<{ created: boolean; corsError?: string }> {
    let created = false;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      created = true;
    }
    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: allowedOrigins,
                AllowedMethods: ["GET", "PUT", "HEAD"],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
      return { created };
    } catch (error) {
      return { created, corsError: error instanceof Error ? error.message : String(error) };
    }
  }
}

/** Content-Disposition có tên file Unicode theo RFC 6266/5987, kèm tên ASCII dự phòng. */
export function contentDisposition(fileName: string, inline: boolean): string {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "NotFound" || candidate.$metadata?.httpStatusCode === 404;
}

let shared: Storage | undefined;

export function getStorage(): Storage {
  shared ??= new Storage(storageConfigFromEnv());
  return shared;
}
