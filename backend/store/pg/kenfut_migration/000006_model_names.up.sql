-- 模型显示名与自定义供应商名：
-- show_name 为模型的展示名（为空时界面回退显示模型 ID）；
-- provider_name 仅在 provider 为自定义（Other）时使用，展示用户命名的供应商。
ALTER TABLE models ADD COLUMN show_name TEXT NOT NULL DEFAULT '';
ALTER TABLE models ADD COLUMN provider_name TEXT NOT NULL DEFAULT '';
