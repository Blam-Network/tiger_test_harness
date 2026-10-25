-- CreateTable
CREATE TABLE "account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "platform_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profile" BLOB
);

-- CreateTable
CREATE TABLE "character" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "account_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "class_index" INTEGER NOT NULL,
    "race_index" INTEGER NOT NULL,
    "gender_index" INTEGER NOT NULL,
    "face_index" INTEGER NOT NULL,
    "hair_index" INTEGER NOT NULL,
    "feature_index" INTEGER NOT NULL,
    "decal_index" INTEGER NOT NULL,
    "skin_color_index" INTEGER NOT NULL,
    "lip_color_index" INTEGER NOT NULL,
    "eye_color_index" INTEGER NOT NULL,
    "hair_color_index" INTEGER NOT NULL,
    "feature_color_index" INTEGER NOT NULL,
    "decal_color_index" INTEGER NOT NULL,
    "personality_id" INTEGER NOT NULL,
    "helmet_preference" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "progression_xp" INTEGER NOT NULL DEFAULT 0,
    "progression_zero_xp" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_played_at" DATETIME,
    "deleted_at" DATETIME,
    "profile" BLOB,
    CONSTRAINT "character_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "character_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "character_id" INTEGER NOT NULL,
    "def_index" INTEGER NOT NULL,
    "bucket" INTEGER NOT NULL,
    "equip_slot" INTEGER,
    "bag_index" INTEGER,
    "sandbox_pattern" INTEGER NOT NULL,
    "art_arrangement" INTEGER NOT NULL,
    "instanced" BOOLEAN NOT NULL DEFAULT true,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "talent_xp" INTEGER NOT NULL DEFAULT 0,
    "talent_nodes" BLOB,
    "power" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "character_item_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "account_platform_id_key" ON "account"("platform_id");

-- CreateIndex
CREATE INDEX "character_account_id_idx" ON "character"("account_id");

-- CreateIndex
CREATE INDEX "character_item_character_id_idx" ON "character_item"("character_id");
