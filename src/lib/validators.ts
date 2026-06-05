import { z } from "zod";

export const leadSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  company_name: z.string().trim().min(2, "Company name is required"),
  email: z.string().trim().email("A valid email is required"),
  phone: z.string().trim().min(7, "Phone number is required"),
  business_type: z.string().trim().min(2, "Business type is required"),
  service_interest: z.string().trim().min(2, "Select a service interest"),
  message: z.string().trim().min(8, "Please add a short message"),
  source_page: z.string().trim().default("website"),
});

export type LeadInput = z.infer<typeof leadSchema>;
