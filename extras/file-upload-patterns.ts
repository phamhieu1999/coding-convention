/**
 * ============================================
 * FILE UPLOAD PATTERNS
 * ============================================
 *
 * Nguyên tắc:
 * 1. Validate file trước khi lưu (type, size, extension)
 * 2. Storage abstraction — dễ switch local ↔ S3 ↔ GCS
 * 3. Presigned URL cho direct upload — không qua server
 * 4. Image processing — resize, compress
 * 5. Virus scan cho uploaded files
 * 6. CDN cho serving static files
 */

declare interface Buffer { length: number }
declare const Buffer: {
  from(data: string | ArrayBuffer): Buffer;
};

// ═══════════════════════════════════════════
// Rule 1: File Validation
// ═══════════════════════════════════════════

// ❌ BAD: Không validate → user upload malware, .exe, 10GB file
/*
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
uploadFile(@UploadedFile() file: Express.Multer.File) {
  fs.writeFileSync(`./uploads/${file.originalname}`, file.buffer);
  // No validation! Path traversal! No size limit!
}
*/

// ✅ GOOD: Strict validation
const UPLOAD_CONFIG = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'text/csv',
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.csv'],
  imageMaxDimensions: { width: 4096, height: 4096 },
  avatarMaxSize: 2 * 1024 * 1024, // 2MB
};

interface FileValidation {
  valid: boolean;
  errors: string[];
}

function validateFile(
  filename: string,
  mimeType: string,
  sizeBytes: number,
  config = UPLOAD_CONFIG,
): FileValidation {
  const errors: string[] = [];

  // Size check
  if (sizeBytes > config.maxSizeBytes) {
    errors.push(`File size ${formatBytes(sizeBytes)} exceeds max ${formatBytes(config.maxSizeBytes)}`);
  }

  // MIME type check
  if (!config.allowedMimeTypes.includes(mimeType)) {
    errors.push(`File type '${mimeType}' is not allowed`);
  }

  // Extension check (double-check, don't trust MIME alone)
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  if (!config.allowedExtensions.includes(ext)) {
    errors.push(`File extension '${ext}' is not allowed`);
  }

  // Filename sanitization
  if (/[<>:"/\\|?*\x00-\x1f]/.test(filename)) {
    errors.push('Filename contains invalid characters');
  }

  return { valid: errors.length === 0, errors };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ═══════════════════════════════════════════
// Rule 2: Storage Abstraction (Strategy Pattern)
// ═══════════════════════════════════════════

// ✅ GOOD: Interface-based storage — swap implementations
interface StorageProvider {
  upload(key: string, data: Buffer, mimeType: string): Promise<UploadResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

interface UploadResult {
  key: string;
  url: string;
  size: number;
}

// Local storage (development)
class LocalStorageProvider implements StorageProvider {
  constructor(private readonly basePath: string = './uploads') {}

  async upload(key: string, data: Buffer, _mimeType: string): Promise<UploadResult> {
    const filePath = `${this.basePath}/${key}`;
    // In real code: fs.writeFile(filePath, data)
    console.log(`[LocalStorage] Saved: ${filePath} (${data.length} bytes)`);
    return { key, url: `/uploads/${key}`, size: data.length };
  }

  async download(key: string): Promise<Buffer> {
    console.log(`[LocalStorage] Read: ${this.basePath}/${key}`);
    return Buffer.from(''); // In real code: fs.readFile
  }

  async delete(key: string): Promise<void> {
    console.log(`[LocalStorage] Deleted: ${this.basePath}/${key}`);
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    return `/uploads/${key}`; // Local doesn't need signing
  }
}

// S3 storage (production)
/*
class S3StorageProvider implements StorageProvider {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async upload(key: string, data: Buffer, mimeType: string): Promise<UploadResult> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: mimeType,
      ACL: 'private',
    }));

    return {
      key,
      url: `https://${this.bucket}.s3.amazonaws.com/${key}`,
      size: data.length,
    };
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  async download(key: string): Promise<Buffer> { ... }
  async delete(key: string): Promise<void> { ... }
}
*/

// ═══════════════════════════════════════════
// Rule 3: File Key Generation
// ═══════════════════════════════════════════

// ❌ BAD: Original filename → collision, path traversal
// uploads/photo.jpg → overwritten!
// uploads/../../../etc/passwd → path traversal!

// ✅ GOOD: Unique, organized key structure
function generateFileKey(
  originalName: string,
  category: string,
  userId?: string,
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalName.substring(originalName.lastIndexOf('.')).toLowerCase();
  const sanitizedExt = ext.replace(/[^a-z0-9.]/g, '');

  // Format: category/YYYY/MM/DD/userId_timestamp_random.ext
  const now = new Date();
  const datePath = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('/');

  const userPrefix = userId ? `${userId}_` : '';
  return `${category}/${datePath}/${userPrefix}${timestamp}_${random}${sanitizedExt}`;
}

// Result: "avatars/2024/01/15/user123_1705312800_x7f2k9.jpg"

// ═══════════════════════════════════════════
// Rule 4: Presigned URL — Direct Upload to S3
// ═══════════════════════════════════════════

// Traditional: Client → Server → S3 (server is bottleneck)
// Presigned:   Client → S3 directly (server only generates URL)

/*
// Backend generates presigned upload URL
@Post('upload/presigned')
async getPresignedUploadUrl(
  @Body() dto: PresignedUploadDto,
  @CurrentUser() user: User,
): Promise<PresignedUrlResponse> {
  // Validate request
  const validation = validateFile(dto.filename, dto.mimeType, dto.fileSize);
  if (!validation.valid) throw new BadRequestException(validation.errors);

  // Generate unique key
  const key = generateFileKey(dto.filename, 'documents', user.id);

  // Create presigned PUT URL (expires in 15 min)
  const command = new PutObjectCommand({
    Bucket: this.bucket,
    Key: key,
    ContentType: dto.mimeType,
    ContentLength: dto.fileSize,
  });
  const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 900 });

  return { uploadUrl, key, expiresIn: 900 };
}

// Frontend uploads directly to S3
// await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': mimeType } });

// Backend confirms upload
@Post('upload/confirm')
async confirmUpload(@Body() dto: ConfirmUploadDto): Promise<FileRecord> {
  // Verify file exists in S3
  // Save record to database
  // Optional: trigger post-processing (resize, scan)
}
*/

// ═══════════════════════════════════════════
// Rule 5: Upload Service
// ═══════════════════════════════════════════

// ✅ GOOD: Complete upload service
class FileUploadService {
  constructor(private readonly storage: StorageProvider) {}

  async uploadFile(
    filename: string,
    data: Buffer,
    mimeType: string,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    // 1. Validate
    const validation = validateFile(filename, mimeType, data.length);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // 2. Generate key
    const key = generateFileKey(
      filename,
      options.category || 'files',
      options.userId,
    );

    // 3. Upload to storage
    const result = await this.storage.upload(key, data, mimeType);

    // 4. Return result
    return result;
  }

  async getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    return this.storage.getSignedUrl(key, expiresIn);
  }

  async deleteFile(key: string): Promise<void> {
    await this.storage.delete(key);
  }
}

interface UploadOptions {
  category?: string;
  userId?: string;
}

export {
  FileUploadService,
  LocalStorageProvider,
  validateFile,
  generateFileKey,
  formatBytes,
  UPLOAD_CONFIG,
  type StorageProvider,
  type UploadResult,
  type UploadOptions,
  type FileValidation,
};
