CREATE DATABASE IF NOT EXISTS s2_balzzx;    //s2_balzzx Ganti Pakai Nama Database Kalian
USE s2_balzzx;    //s2_balzzx Ganti Pakai Nama Database Kalian

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(64),
  full_name VARCHAR(128),
  phone VARCHAR(20),
  email VARCHAR(128),
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);