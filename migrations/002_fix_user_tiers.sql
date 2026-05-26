-- ============================================================
-- 002 — 修正 users 表 user_tier 约束以匹配代码中的 4 级会员体系
-- ============================================================
-- Novel Studio 后端使用的会员等级：
--   free / basic / pro / premium（保留 platinum 以兼容旧数据）

-- 1. 删除旧的约束（CHECK 不支持 ALTER，先删除再重建）
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_tier_check;

-- 2. 添加新约束，包含 basic 和 premium
ALTER TABLE public.users ADD CONSTRAINT users_user_tier_check
    CHECK (user_tier IN ('free', 'basic', 'pro', 'premium', 'platinum'));

-- 3. 确保现有非标准值自动迁移为 'free'
--    （如果有旧数据使用了已移除的 tier 值）
UPDATE public.users SET user_tier = 'free'
WHERE user_tier NOT IN ('free', 'basic', 'pro', 'premium', 'platinum');

-- ============================================================
-- 迁移说明
-- ============================================================
-- 执行方式：在 Supabase SQL Editor 中粘贴运行即可（幂等安全）
-- 此脚本只修改约束，不影响现有数据。
-- 如果未来不需要 platinum（旧版旗舰），可单独清理：
--   ALTER TABLE public.users DROP CONSTRAINT users_user_tier_check;
--   ALTER TABLE public.users ADD CONSTRAINT users_user_tier_check
--       CHECK (user_tier IN ('free', 'basic', 'pro', 'premium'));
