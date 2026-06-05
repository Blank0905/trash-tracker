from pathlib import Path
import importlib.util


def run_import():
    root_dir = Path(__file__).resolve().parents[3]
    core_path = root_dir / "database" / "newimport.py"
    spec = importlib.util.spec_from_file_location("etl_core", core_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("無法載入 ETL 核心檔案 database/newimport.py")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.run_import()


if __name__ == "__main__":
    run_import()
