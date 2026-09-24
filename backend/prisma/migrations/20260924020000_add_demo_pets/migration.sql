CREATE TABLE `Pet` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `species` VARCHAR(20) NOT NULL,
  `breed` VARCHAR(80) NOT NULL,
  `gender` VARCHAR(10) NOT NULL,
  `age` INTEGER NOT NULL,
  `weight` DECIMAL(5, 2) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `note` VARCHAR(255) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Pet` (`name`, `species`, `breed`, `gender`, `age`, `weight`, `status`, `note`, `updatedAt`) VALUES
  ('可乐', '狗狗', '柴犬', '公', 3, 11.80, '健康', '喜欢散步，疫苗已按时完成', CURRENT_TIMESTAMP(3)),
  ('糯米', '猫咪', '英短', '母', 2, 4.60, '观察中', '最近食欲稍有下降，需要持续观察', CURRENT_TIMESTAMP(3)),
  ('布丁', '兔子', '荷兰侏儒兔', '母', 1, 1.20, '健康', '活泼亲人，定期检查牙齿', CURRENT_TIMESTAMP(3)),
  ('旺财', '狗狗', '金毛', '公', 6, 29.50, '需复诊', '关节恢复期，下周安排复诊', CURRENT_TIMESTAMP(3));
