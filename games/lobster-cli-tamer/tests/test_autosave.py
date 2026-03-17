import pathlib
import tempfile

import lobster_cli_tamer.save as save_mod
from lobster_cli_tamer.loader import load_game_data
from lobster_cli_tamer.save import (
    new_save, write_save, load_save,
    write_last_slot, read_last_slot,
)
from lobster_cli_tamer.creature import Creature


def test_last_slot_write_read() -> None:
    data = load_game_data()
    old_dir = save_mod.SAVE_DIR
    old_last = save_mod._LAST_SLOT_FILE
    tmp_dir = pathlib.Path(tempfile.mkdtemp())
    save_mod.SAVE_DIR = tmp_dir
    save_mod._LAST_SLOT_FILE = tmp_dir / "last_slot"
    try:
        # 无存档时 read_last_slot 应返回 None
        assert read_last_slot() is None

        # 新建存档槽 1 → 写入 last_slot
        save = new_save(1, "测试续档")
        write_last_slot(1)
        assert read_last_slot() == 1

        # 换到槽 0 → last_slot 更新
        save0 = new_save(0, "槽0")
        write_last_slot(0)
        assert read_last_slot() == 0

        # 删除存档文件后，read_last_slot 应返回 None（存档不存在）
        (tmp_dir / "save_0.json").unlink()
        assert read_last_slot() is None
    finally:
        save_mod.SAVE_DIR = old_dir
        save_mod._LAST_SLOT_FILE = old_last


def test_auto_save_on_capture_event() -> None:
    """验证捕捉成功后 write_save 被正确触发（通过 mtime 变化检测）。"""
    import time
    data = load_game_data()
    old_dir = save_mod.SAVE_DIR
    tmp_dir = pathlib.Path(tempfile.mkdtemp())
    save_mod.SAVE_DIR = tmp_dir
    try:
        save = new_save(2, "写盘测试")
        path = tmp_dir / "save_2.json"
        mtime_before = path.stat().st_mtime
        time.sleep(0.05)  # 确保时间戳可区分

        # 模拟捕捉成功后的写盘
        save.add_item("jihe_core", 5)
        write_save(save)
        mtime_after = path.stat().st_mtime

        assert mtime_after > mtime_before, "捕捉成功后 write_save 应更新 mtime"
        loaded = load_save(2, data)
        assert loaded.get_item_count("jihe_core") == 5
    finally:
        save_mod.SAVE_DIR = old_dir
