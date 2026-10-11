# Restore rejected image-source changes

A normal source switch restores the previous image ID and crop on the same Sprite when renderer admission fails. The accepted Scene and frame stay valid, so a later Edit can succeed. Render failures are outside this rollback boundary. Existing asset registration, crop, Save/Open/PNG and diagnostic callback policies remain.
