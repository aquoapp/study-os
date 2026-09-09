-- Rollback de 00000000000010_answer_keys.sql

drop index if exists content.answer_key_versions_one_current;
drop table if exists content.answer_key_versions;
drop function if exists content.check_answer_key_chain();
