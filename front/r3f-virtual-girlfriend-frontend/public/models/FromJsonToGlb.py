import argparse
import json
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
JSON_PATH = SCRIPT_DIR / "blender_output.json"
OUTPUT_GLB = SCRIPT_DIR / "BombillaConOjos.glb"

ROUND_DIGITS = 6


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for armature in list(bpy.data.armatures):
        bpy.data.armatures.remove(armature)
    for collection in list(bpy.data.collections):
        if collection.users == 0:
            bpy.data.collections.remove(collection)


def round_seq(values):
    return [round(float(v), ROUND_DIGITS) for v in values]


def apply_transform(obj, data):
    obj.location = data.get("location", (0.0, 0.0, 0.0))
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = data.get("rotation_euler", (0.0, 0.0, 0.0))
    obj.scale = data.get("scale", (1.0, 1.0, 1.0))


def set_custom_properties(obj, props):
    for key, value in props.items():
        obj[key] = value


def build_uv_layers(mesh, uv_layers_data):
    for name, values in uv_layers_data.items():
        layer = mesh.uv_layers.new(name=name)
        for loop_index, uv in enumerate(values):
            layer.data[loop_index].uv = uv[:2]


def build_color_attributes(mesh, color_data):
    for name, payload in color_data.items():
        attr = mesh.color_attributes.new(
            name=name,
            type=payload.get("data_type", "FLOAT_COLOR"),
            domain=payload.get("domain", "CORNER"),
        )
        for index, value in enumerate(payload.get("data", [])):
            if hasattr(attr.data[index], "color"):
                attr.data[index].color = value
            elif hasattr(attr.data[index], "value"):
                attr.data[index].value = value


def build_vertex_groups(obj, weights):
    if not weights:
        return
    for weight_dict in weights:
        for group_name in weight_dict.keys():
            if obj.vertex_groups.get(group_name) is None:
                obj.vertex_groups.new(name=group_name)
    for vertex_index, weight_dict in enumerate(weights):
        for group_name, weight in weight_dict.items():
            obj.vertex_groups[group_name].add([vertex_index], weight, "REPLACE")


def build_shape_keys(obj, mesh_data, shape_keys):
    if not shape_keys:
        return
    basis_coords = shape_keys.get("Basis")
    basis = obj.shape_key_add(name="Basis", from_mix=False)
    if basis_coords and len(basis_coords) == len(mesh_data.vertices):
        for idx, coord in enumerate(basis_coords):
            basis.data[idx].co = coord
    for name, coords in shape_keys.items():
        if name == "Basis":
            continue
        if len(coords) != len(mesh_data.vertices):
            continue
        key = obj.shape_key_add(name=name, from_mix=False)
        for idx, coord in enumerate(coords):
            key.data[idx].co = coord


def create_mesh_object(node, collection):
    mesh_info = node.get("mesh", {})
    mesh_data = bpy.data.meshes.new(f"{node['name']}_Mesh")
    vertices = [tuple(vertex) for vertex in mesh_info.get("vertices", [])]
    polygons = [tuple(poly) for poly in mesh_info.get("polygons", [])]
    mesh_data.from_pydata(vertices, [], polygons)
    mesh_data.update()

    obj = bpy.data.objects.new(node["name"], mesh_data)

    if mesh_info.get("uv_layers"):
        build_uv_layers(mesh_data, mesh_info["uv_layers"])
    if mesh_info.get("color_attributes"):
        build_color_attributes(mesh_data, mesh_info["color_attributes"])
    if mesh_info.get("weights"):
        build_vertex_groups(obj, mesh_info["weights"])
    if mesh_info.get("shape_keys"):
        build_shape_keys(obj, mesh_data, mesh_info["shape_keys"])

    collection.objects.link(obj)
    return obj


def create_armature_object(node, collection):
    arm_data = bpy.data.armatures.new(f"{node['name']}_Armature")
    obj = bpy.data.objects.new(node["name"], arm_data)
    collection.objects.link(obj)

    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones = arm_data.edit_bones
    bone_refs = {}
    for bone_info in node.get("bones", []):
        bone = edit_bones.new(bone_info["name"])
        bone.head = tuple(bone_info.get("head_local", (0.0, 0.0, 0.0)))
        bone.tail = tuple(bone_info.get("tail_local", (0.0, 0.0, 1.0)))
        bone_refs[bone_info["name"]] = bone
    for bone_info in node.get("bones", []):
        parent_name = bone_info.get("parent")
        if parent_name and parent_name in bone_refs:
            bone_refs[bone_info["name"]].parent = bone_refs[parent_name]
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def create_empty_object(node, collection):
    obj = bpy.data.objects.new(node["name"], None)
    collection.objects.link(obj)
    return obj


def build_object(node, collection, parent=None):
    obj_type = node.get("type")
    if obj_type == "MESH":
        obj = create_mesh_object(node, collection)
    elif obj_type == "ARMATURE":
        obj = create_armature_object(node, collection)
    else:
        obj = create_empty_object(node, collection)

    apply_transform(obj, node)
    if node.get("custom_properties"):
        set_custom_properties(obj, node["custom_properties"])

    if parent is not None:
        obj.parent = parent
        if parent.type == "ARMATURE" and obj.type == "MESH":
            modifier = obj.modifiers.new(name="Armature", type="ARMATURE")
            modifier.object = parent

    for child_node in node.get("children", []):
        build_object(child_node, collection, obj)

    return obj


def parse_args():
    parser = argparse.ArgumentParser(description="Reconstruye un GLB a partir del JSON exportado")
    parser.add_argument("--input", default=str(JSON_PATH), help="Ruta del JSON exportado por blenderToJson.py")
    parser.add_argument("--output", default=str(OUTPUT_GLB), help="Ruta donde guardar el GLB resultante")
    parser.add_argument("--clear", action="store_true", help="Eliminar la escena antes de reconstruir")
    if '--' in sys.argv:
        args = sys.argv[sys.argv.index('--') + 1:]
    else:
        args = sys.argv[1:]
    return parser.parse_args(args)


def main():
    args = parse_args()
    json_path = Path(args.input)
    output_path = Path(args.output)

    if args.clear:
        clear_scene()

    with json_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    scene = bpy.context.scene

    collection_map = {}
    for col_data in data.get("collections", []):
        collection = bpy.data.collections.new(col_data["name"])
        scene.collection.children.link(collection)
        collection_map[col_data["name"]] = collection
        for obj_node in col_data.get("objects", []):
            build_object(obj_node, collection)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        export_apply=True,
        use_selection=False,
    )
    print(f"GLB generado en: {output_path}")


if __name__ == "__main__":
    main()
