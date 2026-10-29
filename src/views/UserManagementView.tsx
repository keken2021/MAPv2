/* 
  file summary: user management view component supporting the user directory and add user trigger.
  responsibilities: presents the user directory and launches AddUserModal.
  role in system: main view for user governance navigation (/users).
*/

import React, { useState } from 'react';
import { UserTable } from '../components/tables/UserTable';
import { AddUserModal } from '../components/modals/AddUserModal';

/**
  what: renders user management view for organization and third-party users in light theme.
  how: displays UserTable and launches AddUserModal.
  with what file: src/views/UserManagementView.tsx loaded by App.tsx router.
*/
export const UserManagementView: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="d-flex flex-column gap-4">
      <UserTable onAddUser={() => setIsModalOpen(true)} />
      <AddUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
