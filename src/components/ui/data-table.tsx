import type React from "react";
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id?: string | number }> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  rowClassName?: string;
  tableClassName?: string;
  emptyMessage?: string;
}

export function DataTable<T extends { id?: string | number }>({
  columns,
  data,
  isLoading = false,
  pageSize = 10,
  onRowClick,
  rowClassName,
  tableClassName,
  emptyMessage = "Tidak ada data tersedia",
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(pageSize);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = useMemo(
    () => data.slice(startIndex, endIndex),
    [data, startIndex, endIndex]
  );

  const handleLimitChange = (newLimit: string) => {
    const limit = Number.parseInt(newLimit);
    setItemsPerPage(limit);
    // Reset to first page when changing limit
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className="w-screen md:w-auto sm:mx-0 overflow-x-auto">
      <div className="w-full min-w-full px-4 sm:px-0">
        <Table className={`w-full ${tableClassName && tableClassName}`}>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={String(column.key)}
                  className={column.className}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8"
                >
                  <div className="flex items-center justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8"
                >
                  <p className="text-muted-foreground">{emptyMessage}</p>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, idx) => (
                <TableRow
                  key={row.id || idx}
                  className={cn(onRowClick && "cursor-pointer", rowClassName)}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={String(column.key)}
                      className={column.className}
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : String(row[column.key] || "-")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 mb-4 mx-2 my-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Tampilkan:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={handleLimitChange}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">per halaman</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {startIndex + 1}-{Math.min(endIndex, data.length)} dari{" "}
              {data.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="gap-1 bg-transparent hover:bg-success"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Sebelumnya</span>
            </Button>

            <div className="flex items-center gap-1">
              <Button variant={"default"} size="sm" className="w-8 h-8 p-0">
                {currentPage}
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="gap-1 hover:bg-success"
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
