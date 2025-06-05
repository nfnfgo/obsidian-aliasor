def recycle(block_id):
    if not super_block.full():
        super_block.recycle(block_id)
    else if super_block.full():
        copy_info_block(src=super_block, target=block_id)
        super_block.clear()
        super_block.recycle(block_id)