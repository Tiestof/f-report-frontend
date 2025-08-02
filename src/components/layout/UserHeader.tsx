import type { FC } from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface UserHeaderProps {
  user: any;
  isOpen: boolean;
}

const UserHeader: FC<UserHeaderProps> = ({ user, isOpen }) => {
  const loading = !user || !user.nombre;

  const getInitials = (name: string, lastName: string) =>
    `${name?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();

  const nombre = user?.nombre || '';
  const apellido = user?.apellido_paterno || '';
  const email = user?.email || '';
  const perfil = user?.tipo === 2 ? 'Supervisor' : 'Técnico';

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800">
      <div className="flex items-center justify-center bg-blue-600 text-white font-bold rounded-full w-10 h-10">
        {loading ? (
          <Skeleton circle width={40} height={40} baseColor="#4B5563" highlightColor="#9CA3AF" />
        ) : (
          getInitials(nombre, apellido)
        )}
      </div>

      {isOpen && (
        <div className="flex flex-col">
          {loading ? (
            <>
              <Skeleton width={120} height={12} baseColor="#4B5563" highlightColor="#9CA3AF" />
              <Skeleton width={150} height={10} baseColor="#4B5563" highlightColor="#9CA3AF" />
              <Skeleton width={80} height={10} baseColor="#4B5563" highlightColor="#9CA3AF" />
            </>
          ) : (
            <>
              <span className="text-sm font-semibold">{`${nombre} ${apellido}`}</span>
              <span className="text-xs text-gray-300 truncate">{email}</span>
              <span className="text-xs text-gray-400 italic">{perfil}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default UserHeader;
