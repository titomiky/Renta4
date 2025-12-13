import bpy
import json
from pathlib import Path

OUTPUT_PATH = Path(r"C:\Users\titom\GitHub\QuodemAvatars3D\front\r3f-virtual-girlfriend-frontend\public\models\blender_output.json")
ROUND_DIGITS = 6


def round_seq(values):
    return [round(float(v), ROUND_DIGITS) for v in values]


def matrix_to_list(matrix):
    return [[round(float(matrix[row][col]), ROUND_DIGITS) for col in range(4)] for row in range(4)]


def iter_custom_properties(obj):
    custom = {}
    for key in obj.keys():
        if key not in {"_RNA_UI"}:
            custom[key] = obj[key]
    return custom


def export_uv_layers(mesh):
    return {
        layer.name: [round_seq(uv.uv) for uv in layer.data]
        for layer in mesh.uv_layers
    }


def export_color_attributes(mesh):
    color_layers = {}
    for attr in mesh.color_attributes:
        data = []
        for item in attr.data:
            if hasattr(item, "color"):
                data.append(round_seq(item.color[:4]))
            elif hasattr(item, "value"):
                data.append(round_seq(item.value[:4]))
            else:
                data.append(round_seq(item[:4]))
        color_layers[attr.name] = {
            "domain": attr.domain,
            "data_type": attr.data_type,
            "data": data,
        }
    return color_layers


def export_weights(obj, mesh):
    if not obj.vertex_groups:
        return []
    group_lookup = {group.index: group.name for group in obj.vertex_groups}
    weights = []
    for vertex in mesh.vertices:
        vert_weights = {
            group_lookup[assignment.group]: round(float(assignment.weight), ROUND_DIGITS)
            for assignment in vertex.groups
            if assignment.group in group_lookup
        }
        weights.append(vert_weights)
    return weights


def export_shape_keys(obj):
    shape_keys = obj.data.shape_keys
    if not shape_keys or not shape_keys.key_blocks:
        return {}
    return {
        key_block.name: [round_seq(point.co) for point in key_block.data]
        for key_block in shape_keys.key_blocks
    }


def mesh_triangles(mesh):
    triangles = []
    for tri in mesh.loop_triangles:
        if hasattr(tri, "vertices"):
            triangles.append([int(i) for i in tri.vertices])
            continue
        vertex_indices = getattr(tri, "vertex_indices", None)
        if vertex_indices is not None:
            triangles.append([int(i) for i in vertex_indices])
            continue
        loop_indices = getattr(tri, "loops", None)
        if loop_indices is not None and mesh.loops:
            triangles.append([
                int(mesh.loops[idx].vertex_index)
                for idx in loop_indices
            ])
            continue
        triangles.append([int(idx) for idx in loop_indices or []])
    return triangles


def ensure_mesh_calculations(mesh):
    if hasattr(mesh, "calc_loop_triangles"):
        mesh.calc_loop_triangles()
    if hasattr(mesh, "calc_normals_split"):
        mesh.calc_normals_split()
    elif hasattr(mesh, "calc_normals"):
        mesh.calc_normals()


def mesh_to_dict(obj, depsgraph):
    eval_obj = obj.evaluated_get(depsgraph)
    mesh = eval_obj.to_mesh(preserve_all_data_layers=True, depsgraph=depsgraph)
    ensure_mesh_calculations(mesh)

    mesh_dict = {
        "vertices": [round_seq(v.co) for v in mesh.vertices],
        "normals": [round_seq(v.normal) for v in mesh.vertices],
        "triangles": mesh_triangles(mesh),
        "polygons": [[int(vid) for vid in poly.vertices] for poly in mesh.polygons],
        "materials": [slot.material.name for slot in obj.material_slots if slot.material],
    }

    if mesh.uv_layers:
        mesh_dict["uv_layers"] = export_uv_layers(mesh)

    color_layers = export_color_attributes(mesh)
    if color_layers:
        mesh_dict["color_attributes"] = color_layers

    weights = export_weights(obj, mesh)
    if weights:
        mesh_dict["weights"] = weights

    shape_keys = export_shape_keys(obj)
    if shape_keys:
        mesh_dict["shape_keys"] = shape_keys

    eval_obj.to_mesh_clear()
    return mesh_dict


def armature_to_dict(obj):
    bones = []
    for bone in obj.data.bones:
        bones.append({
            "name": bone.name,
            "parent": bone.parent.name if bone.parent else None,
            "head_local": round_seq(bone.head_local),
            "tail_local": round_seq(bone.tail_local),
            "matrix_local": matrix_to_list(bone.matrix_local),
        })
    return {"bones": bones}


def obj_to_dict(obj, depsgraph):
    data = {
        "name": obj.name,
        "type": obj.type,
        "location": round_seq(obj.location),
        "rotation_euler": round_seq(obj.rotation_euler),
        "scale": round_seq(obj.scale),
        "matrix_world": matrix_to_list(obj.matrix_world),
        "children": [obj_to_dict(child, depsgraph) for child in obj.children],
    }

    if obj.type == "MESH" and obj.data:
        data["mesh"] = mesh_to_dict(obj, depsgraph)

    if obj.type == "ARMATURE" and obj.data:
        data.update(armature_to_dict(obj))

    custom = iter_custom_properties(obj)
    if custom:
        data["custom_properties"] = custom

    return data


def main():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    output = {"collections": []}
    for collection in bpy.data.collections:
        col_dict = {"name": collection.name, "objects": []}
        for obj in collection.objects:
            if obj.parent is None:
                col_dict["objects"].append(obj_to_dict(obj, depsgraph))
        output["collections"].append(col_dict)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(output, handle, indent=2, ensure_ascii=False)

    print(f"Escena exportada en JSON a: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
