USE restaurant_management;

-- Run once on an existing installation after confirming only one branch is Head Office.
ALTER TABLE branches
  ADD COLUMN head_office_unique TINYINT GENERATED ALWAYS AS (IF(is_head_office=1,1,NULL)) STORED AFTER is_head_office,
  ADD UNIQUE KEY uk_branches_single_head_office (head_office_unique);
