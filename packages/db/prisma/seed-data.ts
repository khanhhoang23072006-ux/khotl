// Dữ liệu mẫu để demo. Tên Viện/Trường và học phần lấy theo cách gọi phổ biến ở HUST
// nhưng chỉ mang tính minh họa; danh mục thật sẽ được nhập bằng CSV trong trang quản trị.

export interface FacultySeed {
  code: string;
  name: string;
  nameEn: string;
  shortName: string;
}

export const FACULTIES: FacultySeed[] = [
  { code: "SOICT", name: "Trường Công nghệ Thông tin và Truyền thông", nameEn: "School of Information and Communications Technology", shortName: "Trường CNTT&TT" },
  { code: "SEEE", name: "Trường Điện - Điện tử", nameEn: "School of Electrical and Electronic Engineering", shortName: "Trường Điện - Điện tử" },
  { code: "SME", name: "Trường Cơ khí", nameEn: "School of Mechanical Engineering", shortName: "Trường Cơ khí" },
  { code: "SCLS", name: "Trường Hóa và Khoa học sự sống", nameEn: "School of Chemistry and Life Sciences", shortName: "Trường Hóa và KHSS" },
  { code: "SMSE", name: "Trường Vật liệu", nameEn: "School of Materials Science and Engineering", shortName: "Trường Vật liệu" },
  { code: "SEM", name: "Trường Kinh tế", nameEn: "School of Economics and Management", shortName: "Trường Kinh tế" },
  { code: "FAMI", name: "Khoa Toán - Tin", nameEn: "Faculty of Mathematics and Informatics", shortName: "Khoa Toán - Tin" },
  { code: "FEP", name: "Khoa Vật lý Kỹ thuật", nameEn: "Faculty of Engineering Physics", shortName: "Khoa Vật lý KT" },
  { code: "SOFL", name: "Khoa Ngoại ngữ", nameEn: "School of Foreign Languages", shortName: "Khoa Ngoại ngữ" },
  { code: "FPS", name: "Khoa Lý luận Chính trị", nameEn: "Faculty of Political Science", shortName: "Khoa LLCT" },
];

export interface CourseSeed {
  code: string;
  name: string;
  nameEn: string;
  credits: number;
  faculty: string;
  /** Từ khóa (không dấu) chèn vào nội dung PDF mẫu để thử tìm kiếm trong nội dung */
  keywords: string[];
}

export const COURSES: CourseSeed[] = [
  { code: "MI1111", name: "Giải tích I", nameEn: "Calculus I", credits: 4, faculty: "FAMI", keywords: ["gioi han", "dao ham", "dinh ly Lagrange", "tich phan suy rong"] },
  { code: "MI1121", name: "Giải tích II", nameEn: "Calculus II", credits: 3, faculty: "FAMI", keywords: ["tich phan boi", "tich phan duong", "chuoi so"] },
  { code: "MI1131", name: "Giải tích III", nameEn: "Calculus III", credits: 3, faculty: "FAMI", keywords: ["phuong trinh vi phan", "chuoi Fourier", "bien doi Laplace"] },
  { code: "MI1141", name: "Đại số", nameEn: "Linear Algebra", credits: 4, faculty: "FAMI", keywords: ["ma tran", "dinh thuc", "khong gian vector", "tri rieng"] },
  { code: "MI2020", name: "Xác suất thống kê", nameEn: "Probability and Statistics", credits: 3, faculty: "FAMI", keywords: ["bien ngau nhien", "phan phoi chuan", "kiem dinh gia thuyet"] },
  { code: "PH1110", name: "Vật lý đại cương I", nameEn: "General Physics I", credits: 3, faculty: "FEP", keywords: ["dong luc hoc", "dinh luat Newton", "nhiet dong luc hoc"] },
  { code: "PH1120", name: "Vật lý đại cương II", nameEn: "General Physics II", credits: 3, faculty: "FEP", keywords: ["dien truong", "tu truong", "dinh luat Faraday"] },
  { code: "PH1130", name: "Vật lý đại cương III", nameEn: "General Physics III", credits: 3, faculty: "FEP", keywords: ["giao thoa", "nhieu xa", "luong tu anh sang"] },
  { code: "IT1110", name: "Tin học đại cương", nameEn: "Introduction to Computing", credits: 4, faculty: "SOICT", keywords: ["ngon ngu C", "con tro", "mang mot chieu"] },
  { code: "IT3011", name: "Cấu trúc dữ liệu và giải thuật", nameEn: "Data Structures and Algorithms", credits: 3, faculty: "SOICT", keywords: ["cay nhi phan", "do thi", "sap xep nhanh", "bang bam"] },
  { code: "IT3020", name: "Toán rời rạc", nameEn: "Discrete Mathematics", credits: 3, faculty: "SOICT", keywords: ["to hop", "quan he truy hoi", "do thi Euler"] },
  { code: "IT3030", name: "Kiến trúc máy tính", nameEn: "Computer Architecture", credits: 3, faculty: "SOICT", keywords: ["tap lenh MIPS", "bo nho dem", "pipeline"] },
  { code: "IT3040", name: "Kỹ thuật lập trình", nameEn: "Programming Techniques", credits: 2, faculty: "SOICT", keywords: ["de quy", "quy hoach dong", "kiem thu"] },
  { code: "IT3070", name: "Nguyên lý hệ điều hành", nameEn: "Operating Systems", credits: 3, faculty: "SOICT", keywords: ["tien trinh", "dong bo hoa", "bo nho ao"] },
  { code: "IT3080", name: "Mạng máy tính", nameEn: "Computer Networks", credits: 3, faculty: "SOICT", keywords: ["mo hinh OSI", "TCP/IP", "dinh tuyen"] },
  { code: "IT3090", name: "Cơ sở dữ liệu", nameEn: "Databases", credits: 3, faculty: "SOICT", keywords: ["SQL", "chuan hoa", "phu thuoc ham"] },
  { code: "IT3100", name: "Lập trình hướng đối tượng", nameEn: "Object-Oriented Programming", credits: 2, faculty: "SOICT", keywords: ["ke thua", "da hinh", "Java"] },
  { code: "IT3160", name: "Nhập môn Trí tuệ nhân tạo", nameEn: "Introduction to Artificial Intelligence", credits: 3, faculty: "SOICT", keywords: ["tim kiem A sao", "hoc may", "logic menh de"] },
  { code: "IT4409", name: "Công nghệ Web và dịch vụ trực tuyến", nameEn: "Web Technologies", credits: 3, faculty: "SOICT", keywords: ["HTTP", "REST", "JavaScript"] },
  { code: "ET2000", name: "Nhập môn kỹ thuật điện tử viễn thông", nameEn: "Introduction to Electronics and Telecommunications", credits: 2, faculty: "SEEE", keywords: ["tin hieu", "dieu che"] },
  { code: "EE2000", name: "Tín hiệu và hệ thống", nameEn: "Signals and Systems", credits: 3, faculty: "SEEE", keywords: ["bien doi Fourier", "tich chap", "he thong LTI"] },
  { code: "EE2020", name: "Lý thuyết mạch điện I", nameEn: "Circuit Theory I", credits: 4, faculty: "SEEE", keywords: ["dinh luat Kirchhoff", "mach RLC", "so phuc"] },
  { code: "EE3110", name: "Kỹ thuật đo lường", nameEn: "Measurement Engineering", credits: 3, faculty: "SEEE", keywords: ["sai so", "cam bien"] },
  { code: "ME2015", name: "Đồ họa kỹ thuật cơ bản", nameEn: "Engineering Graphics", credits: 3, faculty: "SME", keywords: ["hinh chieu", "khung ten", "mat cat"] },
  { code: "ME2011", name: "Cơ học kỹ thuật I", nameEn: "Engineering Mechanics I", credits: 3, faculty: "SME", keywords: ["tinh hoc", "ngau luc", "can bang"] },
  { code: "ME3090", name: "Sức bền vật liệu", nameEn: "Strength of Materials", credits: 3, faculty: "SME", keywords: ["ung suat", "bien dang", "uon"] },
  { code: "CH1012", name: "Hóa học đại cương", nameEn: "General Chemistry", credits: 3, faculty: "SCLS", keywords: ["cau tao nguyen tu", "lien ket hoa hoc", "can bang hoa hoc"] },
  { code: "CH3001", name: "Hóa hữu cơ", nameEn: "Organic Chemistry", credits: 3, faculty: "SCLS", keywords: ["hidrocacbon", "co che phan ung"] },
  { code: "MSE2010", name: "Khoa học vật liệu đại cương", nameEn: "Introduction to Materials Science", credits: 3, faculty: "SMSE", keywords: ["mang tinh the", "gian do pha"] },
  { code: "EM1010", name: "Quản trị học đại cương", nameEn: "Principles of Management", credits: 2, faculty: "SEM", keywords: ["hoach dinh", "to chuc", "kiem soat"] },
  { code: "EM1180", name: "Văn hóa kinh doanh và tinh thần khởi nghiệp", nameEn: "Business Culture and Entrepreneurship", credits: 2, faculty: "SEM", keywords: ["khoi nghiep", "mo hinh kinh doanh"] },
  { code: "EM3100", name: "Kinh tế học vi mô", nameEn: "Microeconomics", credits: 3, faculty: "SEM", keywords: ["cung cau", "do co gian", "thi truong"] },
  { code: "FL1100", name: "Tiếng Anh I", nameEn: "English I", credits: 3, faculty: "SOFL", keywords: ["reading", "listening", "grammar"] },
  { code: "FL1101", name: "Tiếng Anh II", nameEn: "English II", credits: 3, faculty: "SOFL", keywords: ["writing", "speaking"] },
  { code: "SSH1111", name: "Triết học Mác - Lênin", nameEn: "Marxist-Leninist Philosophy", credits: 3, faculty: "FPS", keywords: ["phep bien chung", "vat chat va y thuc"] },
  { code: "SSH1121", name: "Kinh tế chính trị Mác - Lênin", nameEn: "Marxist-Leninist Political Economy", credits: 2, faculty: "FPS", keywords: ["gia tri thang du", "hang hoa"] },
  { code: "SSH1131", name: "Chủ nghĩa xã hội khoa học", nameEn: "Scientific Socialism", credits: 2, faculty: "FPS", keywords: ["giai cap cong nhan"] },
  { code: "SSH1141", name: "Lịch sử Đảng Cộng sản Việt Nam", nameEn: "History of the Communist Party of Vietnam", credits: 2, faculty: "FPS", keywords: ["cach mang thang Tam"] },
  { code: "SSH1151", name: "Tư tưởng Hồ Chí Minh", nameEn: "Ho Chi Minh Ideology", credits: 2, faculty: "FPS", keywords: ["doc lap dan toc"] },
  { code: "SSH1170", name: "Pháp luật đại cương", nameEn: "Introduction to Law", credits: 2, faculty: "FPS", keywords: ["quy pham phap luat", "hop dong"] },
];

/** Học phần có tài liệu mẫu (những học phần còn lại để trống để thấy trạng thái rỗng). */
export const COURSES_WITH_DOCUMENTS = [
  "MI1111", "MI1121", "MI1141", "MI2020", "PH1110", "PH1120", "IT1110", "IT3011", "IT3020",
  "IT3040", "IT3070", "IT3080", "IT3090", "IT3100", "EE2000", "EE2020", "ME2015", "CH1012",
  "EM1010", "SSH1111",
];

export interface DocumentTemplate {
  type: "EXAM_FINAL" | "EXAM_MIDTERM" | "SLIDE" | "SOLUTION" | "SYLLABUS" | "NOTES" | "TEXTBOOK";
  title: (courseName: string, term: string, index: number) => string;
  description: string;
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    type: "EXAM_FINAL",
    title: (name, term) => `Đề thi cuối kỳ ${name} kỳ ${term}, có đáp án`,
    description: "Đề thi 90 phút kèm đáp án chi tiết từng câu.",
  },
  {
    type: "EXAM_MIDTERM",
    title: (name, term) => `Đề giữa kỳ ${name} kỳ ${term}`,
    description: "Đề kiểm tra giữa kỳ, có gợi ý lời giải.",
  },
  {
    type: "SLIDE",
    title: (name, _term, index) => `Slide ${name} chương ${index}`,
    description: "Slide bài giảng trên lớp.",
  },
  {
    type: "SOLUTION",
    title: (name) => `Bài giải bài tập ${name}`,
    description: "Lời giải các bài tập về nhà, có giải thích từng bước.",
  },
  {
    type: "NOTES",
    title: (name) => `Ghi chú ôn tập ${name}`,
    description: "Tóm tắt lý thuyết và công thức quan trọng để ôn thi.",
  },
  {
    type: "SYLLABUS",
    title: (name) => `Đề cương học phần ${name}`,
    description: "Đề cương chi tiết: mục tiêu, nội dung, cách đánh giá.",
  },
];

export const DEFAULT_BANNED_WORDS = ["cá độ", "lô đề", "cờ bạc online", "vay nóng"];
