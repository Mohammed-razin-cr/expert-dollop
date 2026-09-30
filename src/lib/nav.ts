import type { Role } from "@/lib/rbac";

export type NavItem = {
  label: string;
  href: string;
  icon: string; // lucide-react icon name
  child?: boolean;
};

export const MARKETING_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "My Tasks", href: "/marketing", icon: "ListTodo" },
  {
    label: "Posters",
    href: "/marketing?category=poster",
    icon: "Image",
    child: true,
  },
  {
    label: "Videos",
    href: "/marketing?category=video",
    icon: "Clapperboard",
    child: true,
  },
  {
    label: "Lead Campaigns",
    href: "/marketing?category=lead_campaign",
    icon: "Target",
    child: true,
  },
  {
    label: "Google Ads",
    href: "/marketing?category=google_ads",
    icon: "BadgeIndianRupee",
    child: true,
  },
  {
    label: "Broadcasts",
    href: "/marketing?category=broadcast",
    icon: "Radio",
    child: true,
  },
  {
    label: "Blogs",
    href: "/marketing?category=blog",
    icon: "FileText",
    child: true,
  },
  {
    label: "Instagram",
    href: "/marketing?category=instagram",
    icon: "Instagram",
    child: true,
  },
  {
    label: "Facebook",
    href: "/marketing?category=facebook",
    icon: "Facebook",
    child: true,
  },
  {
    label: "LinkedIn",
    href: "/marketing?category=linkedin",
    icon: "Linkedin",
    child: true,
  },
  {
    label: "Followers & Community",
    href: "/marketing?category=followers",
    icon: "UsersRound",
    child: true,
  },
  {
    label: "Workshops",
    href: "/marketing?category=workshop",
    icon: "Presentation",
    child: true,
  },
  {
    label: "Brochures",
    href: "/marketing?category=brochure",
    icon: "PanelsTopLeft",
    child: true,
  },
  {
    label: "SEO",
    href: "/marketing?category=seo",
    icon: "Search",
    child: true,
  },
  {
    label: "Other",
    href: "/marketing?category=other",
    icon: "ClipboardList",
    child: true,
  },
  { label: "Reports", href: "/marketing/reports", icon: "FileSpreadsheet" },
  {
    label: "Analytics",
    href: "/marketing/analytics",
    icon: "ChartNoAxesCombined",
  },
  { label: "Profile", href: "/profile", icon: "User" },
];

// Sidebars transcribed from the Trainer / BD / Admin mockups.
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  trainer: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    // Batches is reached from the Batches tab on /courses, not its own
    // sidebar entry. The /batches route still works for bookmarks.
    { label: "My Courses", href: "/courses", icon: "BookOpen" },
    { label: "Students", href: "/students", icon: "GraduationCap" },
    { label: "Attendance", href: "/attendance", icon: "CalendarCheck" },
    { label: "Daily Topics", href: "/topics", icon: "ClipboardList" },
    { label: "Assessments", href: "/assessments", icon: "FileCheck" },
    { label: "Assignments", href: "/assignments", icon: "ClipboardList" },
    { label: "Materials", href: "/materials", icon: "FolderOpen" },
    { label: "Certificates", href: "/certificates", icon: "Award" },
    { label: "Reports", href: "/reports", icon: "BarChart3" },
    { label: "My Tasks", href: "/tasks", icon: "CheckSquare" },
    { label: "Calendar", href: "/calendar", icon: "Calendar" },
    { label: "Profile", href: "/profile", icon: "User" },
  ],
  bd: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { label: "Leads / CRM", href: "/leads", icon: "Contact" },
    { label: "Google Sheet Sync", href: "/gsheet", icon: "Sheet" },
    { label: "Follow-ups", href: "/followups", icon: "PhoneCall" },
    { label: "Students", href: "/students", icon: "GraduationCap" },
    { label: "Onboarding", href: "/onboarding", icon: "UserCheck" },
    { label: "Aptitude", href: "/aptitude", icon: "Brain" },
    { label: "Courses and Internships", href: "/programs", icon: "Briefcase" },
    { label: "Courses Details", href: "/courses", icon: "BookOpen" },
    {
      label: "Trainer Assignment",
      href: "/trainer-assignment",
      icon: "UserCog",
    },
    { label: "Projects", href: "/projects", icon: "FolderKanban" },
    //{ label: 'Finance', href: '/finance', icon: 'Wallet' },
    { label: "Revenue", href: "/revenue", icon: "IndianRupee" },
    { label: "Invoicing", href: "/invoicing", icon: "Receipt" },
    { label: "Reports", href: "/reports", icon: "BarChart3" },
    { label: "My Performance", href: "/performance", icon: "TrendingUp" },
    { label: "Calendar", href: "/calendar", icon: "Calendar" },
    { label: "Tasks", href: "/tasks", icon: "CheckSquare" },
    { label: "Profile", href: "/profile", icon: "User" },
  ],
  admin: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { label: "CRM / Leads", href: "/leads", icon: "Contact" },
    { label: "Pipeline", href: "/pipeline", icon: "Filter" },
    { label: "Sales Funnel", href: "/sales-funnel", icon: "TrendingDown" },
    { label: "Google Sheet Sync", href: "/gsheet", icon: "Sheet" },
    { label: "Students", href: "/students", icon: "GraduationCap" },
    { label: "Onboarding", href: "/onboarding", icon: "UserCheck" },
    { label: "Courses Details", href: "/courses", icon: "BookOpen" },
    {
      label: "Trainer Assignment",
      href: "/trainer-assignment",
      icon: "UserCog",
    },
    { label: "Aptitude", href: "/aptitude", icon: "Brain" },
    { label: "Courses and Internships", href: "/programs", icon: "Briefcase" },
    { label: "Internship", href: "/internships", icon: "Briefcase" },
    { label: "Placement", href: "/placements", icon: "Building2" },
    { label: "Daily Topics", href: "/topics", icon: "ClipboardList" },
    { label: "Assessments", href: "/assessments", icon: "FileCheck" },
    { label: "Certificates", href: "/certificates", icon: "Award" },
    { label: "Projects", href: "/projects", icon: "FolderKanban" },
    { label: "Finance", href: "/finance", icon: "Wallet" },
    { label: "Revenue", href: "/revenue", icon: "IndianRupee" },
    { label: "Invoicing", href: "/invoicing", icon: "Receipt" },
    { label: "Analytics", href: "/analytics", icon: "LineChart" },
    {
      label: "Digital Marketing",
      href: "/admin/digital-marketing",
      icon: "Megaphone",
    },
    {
      label: "Marketing Tasks",
      href: "/admin/digital-marketing?view=tasks",
      icon: "ListChecks",
      child: true,
    },
    {
      label: "Marketing Analytics",
      href: "/admin/digital-marketing?view=analytics",
      icon: "ChartNoAxesCombined",
      child: true,
    },
    {
      label: "Marketing Reports",
      href: "/admin/digital-marketing?view=reports",
      icon: "FileSpreadsheet",
      child: true,
    },
    { label: "Reports", href: "/reports", icon: "BarChart3" },
    { label: "Users & Roles", href: "/users", icon: "Users" },
    { label: "Settings", href: "/settings", icon: "Settings" },
    { label: "Data Safety", href: "/data-safety", icon: "ShieldCheck" },
    { label: "Productivity", href: "/productivity", icon: "Activity" },
    { label: "Profile", href: "/profile", icon: "User" },
  ],
  super_admin: [], // populated below (same as admin)
  counsellor: [], // populated below (same as bd)
  student: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { label: "My Courses", href: "/courses", icon: "BookOpen" },
    { label: "Attendance", href: "/attendance", icon: "CalendarCheck" },
    { label: "Assignments", href: "/assignments", icon: "ClipboardList" },
    { label: "Invoices", href: "/invoicing", icon: "Receipt" },
    { label: "Profile", href: "/profile", icon: "User" },
  ],
};

NAV_BY_ROLE.super_admin = NAV_BY_ROLE.admin;
// Counsellor shares the BD sidebar — same access, same screens.
NAV_BY_ROLE.counsellor = NAV_BY_ROLE.bd;

export const navFor = (role: Role, roleKey?: string | null): NavItem[] =>
  roleKey === "digital_marketing" ? MARKETING_NAV : (NAV_BY_ROLE[role] ?? []);
