CREATE TABLE public.opportunities_mailto_backup_20260825 AS
SELECT id, event_url, organizer_email, is_active FROM public.opportunities
WHERE id IN ('c1b54f48-f884-4fb9-819e-8ff681ec4500','4f9e2921-aa6c-4372-a317-84f2a09e2467');

CREATE TABLE public.opportunities_deadlink_backup_20260825 AS
SELECT id, source, event_url, is_active FROM public.opportunities
WHERE id IN ('2c518a9e-12f8-4c38-aac7-d2b8cc7dcaee','2249e363-57f4-4a35-af1e-5ab22a8ed52c','1b2260b1-7f70-4292-95a9-10a53a229dda','70535445-4170-454a-beab-7c51ca1e9223','8836e05a-3782-4bee-aee0-af4c00e069fe','c0e532b9-0a0a-4e4a-91e4-41eacb3bee9b','b05a2074-f24d-451c-b264-8f3ec19fd28b','8c77450b-9c77-4660-a23e-1955de67dee9','d1ecb9cd-46c2-45f1-aaf7-c5baeb613438','f58441ed-0440-4294-8b45-6fc26adca831','a3ec214e-b750-4a1e-ba7c-965e017b1a97','341e2a41-daed-4b90-9dab-8a4619c41bac','ad488454-95f8-421d-8808-741b36b885da','a8f40043-8291-4879-a664-0ce1507d5e2b','bf124f72-ca92-406d-9e40-226c983391d1','3e6fd04b-655e-426f-bdb1-ccfa68806987','aa0a50db-c212-40a4-a23d-38bd53e01a6c','2a962b92-ef3d-4071-8181-2b4891667f33','caa663f0-2e73-47e1-a990-9235ef4ca341','39f6a8e5-36a7-4eaa-912c-6c6a6a64f292','dda8b31c-a171-40cc-9212-534ac3f3e4cb','6d2fcc0e-d253-4a03-acba-ade57cbe97ba','6df33254-f88c-4a92-8673-fea8af05475a','401b781c-8ed9-49db-a5c8-b47df4952893','965f0a6e-25c9-48fc-beb4-396ed8fad1f7','48fe3e3f-49a3-4603-aa05-de6c6a290dd5','3780737a-a5e2-4371-ae7c-9fef5cdbdc2d','8f546de9-6725-40e6-8a1b-675cb99232f9','1a44dadd-0df0-4a9d-8a8e-24d552042a9e','956645a9-5889-4ba9-b735-f22de7efd811','48a7fa92-8270-4f76-9f40-dc795dd11f1d','0bb4b54d-25c2-4447-80e4-b0aaf4bbcdae','2ebf85fb-312a-4af2-b4f3-e068ddab9f05','7b126bbf-2615-4cfb-a76a-e2bc63a28a29','5edef625-fd1b-41d0-8d75-82c58a4a43d5','1d9b7210-b415-483f-98ba-bc747a5d042c','8929118c-5945-491b-995f-5f9f64bc9cbd','2eea22d1-32b7-4de3-990b-23f8c9f9aca9','d99856d1-113f-4ee8-a4fb-0129ce223fbb','aa1c4d38-dc72-4b6a-afe1-8a179f1ff4e6','97f77205-7859-457f-8880-58f1ecb65f66','3a4bb0e8-aeed-47ec-be4c-e502c2e452d3','6628070d-f9ff-431b-ab0d-5070f790ded9','2ad295a0-b288-4570-a60c-21980c64a443','d36f26cd-b8ee-4272-bec0-e82ec8c842cd','12025590-6332-44f0-a888-9ce933185ed8','d8ff62c4-4314-4780-a983-85c3b1c97f91','3b17d5be-b9a4-4704-a935-af4737e8f339','46ffdaf1-f815-4ab3-ada1-aa669ff12d69','74f7d828-d2b0-4f0e-9706-10f8fecbccf1','7f973e78-ce9b-496f-8c14-a6b168006851');

CREATE TABLE public.link_check_results (
  opportunity_id uuid PRIMARY KEY REFERENCES public.opportunities(id) ON DELETE CASCADE,
  url text,
  last_status text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.link_check_results TO authenticated;
GRANT ALL ON public.link_check_results TO service_role;

ALTER TABLE public.link_check_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view link check results"
ON public.link_check_results FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_link_check_results_updated_at
BEFORE UPDATE ON public.link_check_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();