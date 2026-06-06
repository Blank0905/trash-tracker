from pathlib import Path
import importlib.util


def _resolve_core_path() -> Path:
    current_file = Path(__file__).resolve()
    for parent in current_file.parents:
        candidate = parent / "database" / "newimport.py"
        if candidate.exists():
            return candidate
    raise RuntimeError("Cannot find ETL core file database/newimport.py")


def run_import():
    core_path = _resolve_core_path()
    spec = importlib.util.spec_from_file_location("etl_core", core_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load ETL core file database/newimport.py")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.run_import()


if __name__ == "__main__":
    run_import()
