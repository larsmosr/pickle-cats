# Delete Functionality Design

## Overview

Add delete functionality for game days and groups with confirmation alerts before deletion.

## Game Day Deletion

### Locations

1. **Game Day Page (`$gameDayId.tsx`)** - Delete button with trash icon in header area, near "Finish Day" button
2. **Groups Page - Game Days Tab (`$groupId.tsx`)** - Delete button on each game day card

### Confirmation Dialog

```
Title: Delete Game Day?
Description: Are you sure you want to delete this game day?

[Cancel]  [Delete]
```

### Behavior

- Cancel button: outline variant
- Delete button: destructive variant
- After deletion from game day page: navigate to parent group (`/groups/$groupId`)
- After deletion from game days list: stay on page, list updates via Convex reactivity

## Group Deletion

### Locations

1. **Group Page (`$groupId.tsx`)** - Delete button with trash icon in header area
2. **Groups Index Page (`/groups/index.tsx`)** - Delete button on each group card

### Confirmation Dialog

```
Title: Delete Group?
Description: Are you sure you want to delete this group?

[Cancel]  [Delete]
```

### Behavior

- Cancel button: outline variant
- Delete button: destructive variant
- After deletion from group page: navigate to groups index (`/groups`)
- After deletion from groups list: stay on page, list updates via Convex reactivity

## Button Style

All delete buttons use:
- Icon + text format: `<Trash2 icon> Delete`
- Destructive variant (red styling)

## Implementation Pattern

```tsx
<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" size="sm">
      <Trash2 className="size-4" />
      Delete
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Game Day?</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete this game day?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Files to Modify

1. `src/routes/_authenticated/game-day/$gameDayId.tsx` - add delete button + dialog
2. `src/routes/_authenticated/groups/$groupId.tsx` - add delete to game day cards + group header
3. `src/routes/_authenticated/groups/index.tsx` - add delete to group cards
