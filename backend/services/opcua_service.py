import asyncio
from typing import Optional, List, Dict


async def _run_async(coro):
    """Run an async coroutine from sync context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _test_connection_async(endpoint_url: str, username: str = "", password: str = "") -> dict:
    try:
        from asyncua import Client
        client = Client(url=endpoint_url, timeout=5)
        if username and password:
            client.set_user(username)
            client.set_password(password)
        async with client:
            name = await client.get_server_node().read_display_name()
            return {"success": True, "message": f"Connected: {name.Text}"}
    except ImportError:
        return {"success": False, "message": "asyncua library not installed"}
    except Exception as e:
        return {"success": False, "message": str(e)}


async def _browse_node_async(
    endpoint_url: str,
    node_id: Optional[str],
    username: str = "",
    password: str = "",
) -> List[Dict]:
    try:
        from asyncua import Client
        from asyncua.ua import NodeClass

        client = Client(url=endpoint_url, timeout=15)
        if username and password:
            client.set_user(username)
            client.set_password(password)

        async with client:
            if node_id:
                node = client.get_node(node_id)
            else:
                node = client.get_objects_node()

            children = await node.get_children()
            result = []

            for child in children:
                try:
                    node_class = await child.read_node_class()
                    browse_name = await child.read_browse_name()
                    display_name = await child.read_display_name()

                    child_nid = child.nodeid
                    namespace = child_nid.NamespaceIndex
                    identifier = child_nid.Identifier

                    if isinstance(identifier, int):
                        identifier_type = "i"
                        identifier_str = str(identifier)
                    elif isinstance(identifier, bytes):
                        identifier_type = "b"
                        identifier_str = identifier.hex()
                    else:
                        identifier_type = "s"
                        identifier_str = str(identifier)

                    is_variable = node_class == NodeClass.Variable
                    has_children = False

                    if not is_variable:
                        try:
                            gc = await child.get_children()
                            has_children = len(gc) > 0
                        except Exception:
                            pass

                    data_type = ""
                    if is_variable:
                        try:
                            dt_node_id = await child.read_data_type()
                            data_type = str(dt_node_id)
                        except Exception:
                            pass

                    result.append({
                        "node_id": child.nodeid.to_string(),
                        "namespace": namespace,
                        "identifier": identifier_str,
                        "identifier_type": identifier_type,
                        "browse_name": browse_name.Name or "",
                        "display_name": (display_name.Text or browse_name.Name or ""),
                        "node_class": node_class.name,
                        "is_variable": is_variable,
                        "has_children": has_children,
                        "data_type": data_type,
                        "path": "",
                    })
                except Exception:
                    continue

            return result
    except ImportError:
        raise RuntimeError("asyncua library not installed")
    except Exception as e:
        raise RuntimeError(f"Browse failed: {e}")


async def _scan_all_variables_async(
    endpoint_url: str,
    username: str = "",
    password: str = "",
    max_depth: int = 8,
) -> List[Dict]:
    try:
        from asyncua import Client
        from asyncua.ua import NodeClass

        client = Client(url=endpoint_url, timeout=60)
        if username and password:
            client.set_user(username)
            client.set_password(password)

        variables = []

        async with client:
            async def browse_recursive(node, depth: int, path: str):
                if depth > max_depth:
                    return
                try:
                    children = await node.get_children()
                except Exception:
                    return

                for child in children:
                    try:
                        node_class = await child.read_node_class()
                        display_name = await child.read_display_name()
                        name = display_name.Text or ""
                        current_path = f"{path}/{name}" if path else name

                        child_nid = child.nodeid
                        namespace = child_nid.NamespaceIndex
                        identifier = child_nid.Identifier

                        if isinstance(identifier, int):
                            identifier_type = "i"
                            identifier_str = str(identifier)
                        elif isinstance(identifier, bytes):
                            identifier_type = "b"
                            identifier_str = identifier.hex()
                        else:
                            identifier_type = "s"
                            identifier_str = str(identifier)

                        if node_class == NodeClass.Variable:
                            data_type = ""
                            try:
                                dt_node_id = await child.read_data_type()
                                data_type = str(dt_node_id)
                            except Exception:
                                pass

                            variables.append({
                                "node_id": child.nodeid.to_string(),
                                "namespace": namespace,
                                "identifier": identifier_str,
                                "identifier_type": identifier_type,
                                "browse_name": name,
                                "display_name": name,
                                "node_class": "Variable",
                                "is_variable": True,
                                "has_children": False,
                                "data_type": data_type,
                                "path": current_path,
                            })
                        else:
                            await browse_recursive(child, depth + 1, current_path)
                    except Exception:
                        continue

            objects_node = client.get_objects_node()
            await browse_recursive(objects_node, 0, "")

        return variables
    except ImportError:
        raise RuntimeError("asyncua library not installed")
    except Exception as e:
        raise RuntimeError(f"Scan failed: {e}")


def test_connection(endpoint_url: str, username: str = "", password: str = "") -> dict:
    return _run_async(_test_connection_async(endpoint_url, username, password))


def browse_node(endpoint_url: str, node_id: Optional[str] = None, username: str = "", password: str = "") -> List[Dict]:
    return _run_async(_browse_node_async(endpoint_url, node_id, username, password))


def scan_all_variables(endpoint_url: str, username: str = "", password: str = "", max_depth: int = 8) -> List[Dict]:
    return _run_async(_scan_all_variables_async(endpoint_url, username, password, max_depth))
