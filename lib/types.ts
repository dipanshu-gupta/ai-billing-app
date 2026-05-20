// ─── Auth & Users ────────────────────────────────────────────────────────────

export interface EnterpriseUser {
  id: string;
  employee_code: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  designation: string;
  organization_id: string;
  business_unit_id: string;
  role_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  organization_code: string;
  status: string;
  industry: string;
  website: string;
  country: string;
  timezone: string;
  currency: string;
  created_at: string;
}

export interface BusinessUnit {
  id: string;
  name: string;
  business_unit_code: string;
  organization_id: string;
  description: string;
  status: string;
  created_at: string;
}

export interface Role {
  id: string;
  role_name: string;
  role_code: string;
  description: string;
  status: string;
  created_at: string;
}

export interface Permission {
  id: string;
  permission_name: string;
  permission_code: string;
  module_name: string;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  permissions?: Permission;
}

export interface UserGroup {
  id: string;
  group_name: string;
  group_code: string;
  description: string;
  organization_id: string;
  business_unit_id: string;
  status: string;
  created_at: string;
}

export interface UserGroupMember {
  id: string;
  user_group_id: string;
  enterprise_user_id: string;
  enterprise_users?: EnterpriseUser;
}

// ─── CRM Objects ──────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  billingAddress: string;
  shippingAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  website: string;
  gstNumber: string;
  primaryContactId: string;
  primaryContact: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface Contact {
  id: string;
  customerId: string;
  customer: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  isPrimary: boolean;
  status: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  status: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface Lead {
  id: string;
  name: string;
  customer: string;
  customerId: string;
  contact: string;
  contactId: string;
  email: string;
  phone: string;
  source: string;
  amount: number;
  status: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface Opportunity {
  id: string;
  name: string;
  customer: string;
  customerId: string;
  contact: string;
  contactId: string;
  stage: string;
  amount: number;
  closeDate: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface Order {
  id: string;
  name: string;
  customer: string;
  customerId: string;
  contact: string;
  contactId: string;
  amount: number;
  shippingAddress: string;
  deliveryDate: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface Invoice {
  id: string;
  name: string;
  customer: string;
  customerId: string;
  contact: string;
  contactId: string;
  amount: number;
  dueDate: string;
  paymentTerms: string;
  billingAddress: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface Activity {
  id: string;
  name: string;
  customer: string;
  customerId: string;
  contact: string;
  contactId: string;
  subject: string;
  activityType: string;
  activityDate: string;
  notes: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface LineItem {
  id: string | number;
  product: string;
  quantity: number;
  price: number;
}

// ─── Collaboration ────────────────────────────────────────────────────────────

export interface RecordNote {
  id: string;
  record_type: string;
  record_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface RecordComment {
  id: string;
  record_type: string;
  record_id: string;
  parent_comment_id: string | null;
  body: string;
  mentions: string[];
  created_by: string;
  created_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface RecordAttachment {
  id: string;
  record_type: string;
  record_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface AuditLog {
  id: string;
  record_type: string;
  record_id: string;
  record_name: string;
  action: string;
  field_changed: string;
  old_value: string;
  new_value: string;
  performed_by: string;
  performed_at: string;
  organization_id: string;
  business_unit_id: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  recipient_email: string;
  type: string;
  title: string;
  body: string;
  record_type: string;
  record_id: string;
  is_read: boolean;
  created_at: string;
}

// ─── Workflow Engine ──────────────────────────────────────────────────────────

export interface WorkflowRule {
  id: string;
  rule_number: string;
  name: string;
  description: string;
  object_type: string;
  trigger_event: string;
  trigger_field: string;
  trigger_value: string;
  is_active: boolean;
  status: string;
  created_by: string;
  created_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface WorkflowAction {
  id: string;
  workflow_rule_id: string;
  action_type: string;
  action_config: Record<string, any>;
  execution_order: number;
}

export interface AssignmentRule {
  id: string;
  rule_number: string;
  name: string;
  object_type: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  assign_to_user_id: string;
  assign_to_group_id: string;
  priority: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface SLAPolicy {
  id: string;
  policy_number: string;
  name: string;
  object_type: string;
  condition_field: string;
  condition_value: string;
  response_time_hours: number;
  resolution_time_hours: number;
  warning_threshold_pct: number;
  escalate_to_user_id: string;
  escalate_to_group_id: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface SLARecord {
  id: string;
  sla_policy_id: string;
  record_type: string;
  record_id: string;
  started_at: string;
  response_due_at: string;
  resolution_due_at: string;
  responded_at: string | null;
  resolved_at: string | null;
  status: string;
}

export interface ApprovalProcess {
  id: string;
  process_number: string;
  name: string;
  object_type: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  organization_id: string;
  business_unit_id: string;
}

export interface ApprovalStep {
  id: string;
  approval_process_id: string;
  step_number: number;
  step_name: string;
  approver_user_id: string;
  approver_group_id: string;
  approval_type: string;
  on_approve_action: string;
  on_reject_action: string;
}

export interface ApprovalRequest {
  id: string;
  request_number: string;
  approval_process_id: string;
  current_step_id: string;
  record_type: string;
  record_id: string;
  record_name: string;
  submitted_by: string;
  submitted_at: string;
  status: string;
  comments: string;
  organization_id: string;
  business_unit_id: string;
}

// ─── Quote Templates ──────────────────────────────────────────────────────────

export interface QuoteTemplate {
  id: string;
  dbId?: string;
  name: string;
  isDefault: boolean;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  quoteTitle: string;
  footerText: string;
  termsAndConditions: string;
  primaryColor: string;
  secondaryColor: string;
}

// ─── App Pages ────────────────────────────────────────────────────────────────

export type PageKey =
  | 'dashboard'
  | 'customers'
  | 'products'
  | 'leads'
  | 'opportunities'
  | 'activities'
  | 'contacts'
  | 'orders'
  | 'invoices'
  | 'adminTools';

export type CRMRecord = Customer | Contact | Product | Lead | Opportunity | Order | Invoice | Activity;
